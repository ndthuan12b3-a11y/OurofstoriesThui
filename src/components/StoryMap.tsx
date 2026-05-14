import React, { useEffect, useState, useMemo, useRef } from 'react';
import { MapContainer, TileLayer, Marker, Popup, useMap, ZoomControl } from 'react-leaflet';
import L, { divIcon } from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { motion, AnimatePresence } from 'motion/react';
import { Calendar, MapPin, Navigation as NavIcon, Heart, X, ChevronRight, User, Sparkles, Compass, Eye } from 'lucide-react';
import { AppConfig } from '../types';
import { formatDate, cleanAddress, cn } from '../lib/utils';
import MarkerClusterGroup from 'react-leaflet-cluster';
import { useMapLogic } from '../hooks/useMapLogic';

// Throttled Marker for smooth transitions
const SmoothMarker = ({ position, icon, children }: { position: [number, number], icon?: any, children?: React.ReactNode }) => {
  const [currentPos, setCurrentPos] = useState<[number, number]>(position);
  const markerRef = useRef<L.Marker>(null);
  const requestRef = useRef<number>(0);

  useEffect(() => {
    const animate = () => {
      const curLat = currentPos[0];
      const curLng = currentPos[1];
      const tarLat = position[0];
      const tarLng = position[1];

      if (isNaN(curLat) || isNaN(curLng) || isNaN(tarLat) || isNaN(tarLng)) {
        return;
      }

      const dfLat = tarLat - curLat;
      const dfLng = tarLng - curLng;
      
      // Dynamic factor based on distance to be smoother for small movements
      const distance = Math.sqrt(dfLat * dfLat + dfLng * dfLng);
      const factor = distance > 0.01 ? 0.15 : 0.08; 
      
      if (Math.abs(dfLat) < 0.0000001 && Math.abs(dfLng) < 0.0000001) {
        if (markerRef.current) {
          markerRef.current.setLatLng(position);
        }
        return;
      }

      const nextPos: [number, number] = [
        curLat + dfLat * factor,
        curLng + dfLng * factor
      ];
      
      setCurrentPos(nextPos);
      if (markerRef.current) {
        markerRef.current.setLatLng(nextPos);
      }
      requestRef.current = requestAnimationFrame(animate);
    };

    requestRef.current = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(requestRef.current!);
  }, [position, currentPos]);

  return (
    <Marker ref={markerRef} position={currentPos} icon={icon}>
      {children}
    </Marker>
  );
};

  // Map center/zoom controller
  const MapViewHandler = ({ center, zoom }: { center: [number, number], zoom: number }) => {
    const map = useMap();
    useEffect(() => {
      if (isNaN(center[0]) || isNaN(center[1]) || isNaN(zoom)) return;

      map.flyTo(center, zoom, {
      duration: 2.8,
      easeLinearity: 0.25
    });
    // Force recalculate size after a short delay to handle animation/mounting issues
    const timer = setTimeout(() => {
      map.invalidateSize();
    }, 100);
    return () => clearTimeout(timer);
  }, [center, zoom, map]);

  useEffect(() => {
    // Add a ResizeObserver to automatically invalidate size when container changes
    if (typeof ResizeObserver !== 'undefined') {
      const observer = new ResizeObserver(() => {
        map.invalidateSize();
      });
      observer.observe(map.getContainer());
      return () => observer.disconnect();
    }
  }, [map]);
  
  return null;
};

interface UserMarkerProps {
  position: [number, number];
  name: string;
  imageUrl?: string | null;
  isOffline?: boolean;
  color?: 'rose' | 'blue';
  address?: string;
}

const UserMarker: React.FC<UserMarkerProps> = ({ position, name, imageUrl, isOffline, color = 'rose', address = "" }) => {
  const pingColor = color === 'rose' ? 'bg-rose-400/20' : 'bg-blue-400/20';
  const pulseBorder = color === 'rose' ? 'border-rose-400/30' : 'border-blue-400/30';

  const cleanedAddress = useMemo(() => cleanAddress(address), [address]);

  const icon = useMemo(() => divIcon({
    className: 'custom-div-icon',
    html: `
      <div class="relative group">
        ${cleanedAddress ? `
          <div class="absolute -top-10 left-1/2 -translate-x-1/2 flex flex-col items-center pointer-events-none group-hover:scale-110 transition-transform duration-300">
            <div class="bg-white/95 backdrop-blur-xl px-2.5 py-1 rounded-xl border border-white/50 shadow-xl flex flex-col items-center min-w-[80px]">
              <span class="text-[9px] font-black text-gray-900 leading-none whitespace-nowrap">${cleanedAddress.split(',')[0]}</span>
              ${cleanedAddress.split(',')[1] ? `
                <span class="text-[7px] font-bold text-primary leading-tight mt-0.5 whitespace-nowrap opacity-80 uppercase tracking-tighter">${cleanedAddress.split(',').slice(1).join(',')}</span>
              ` : ''}
            </div>
            <div class="w-0.5 h-2 bg-white/60 blur-[0.5px]"></div>
          </div>
        ` : ''}

        ${!isOffline ? `<div class="absolute -inset-2 bg-${color === 'rose' ? 'rose' : 'blue'}-500/20 rounded-full animate-ping opacity-75 z-0"></div>` : ''}
        <div class="relative w-12 h-12 bg-white rounded-[14px] shadow-2xl z-20 flex items-center justify-center p-[2px]" style="border: 3px solid ${isOffline ? '#94a3b8' : (color === 'rose' ? '#fb7185' : '#60a5fa')}">
          <div style="width: 100%; height: 100%; border-radius: 9px; overflow: hidden; background-color: #f3f4f6; position: relative;">
            ${imageUrl ? 
              `<img src="${imageUrl}" alt="avatar" style="width: 100%; height: 100%; object-fit: cover;" />` : 
              `<div style="width: 100%; height: 100%; display: flex; align-items: center; justify-center; background: #e2e8f0; color: #64748b;">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
              </div>`
            }
          </div>
          ${!isOffline ? `<div class="absolute -bottom-1 -right-1 w-4 h-4 bg-green-500 border-2 border-white rounded-full z-30"></div>` : ''}
        </div>
        <div class="absolute -bottom-6 left-1/2 -translate-x-1/2 whitespace-nowrap z-30">
          <span class="px-2 py-0.5 bg-white/90 backdrop-blur-sm rounded-full text-[8px] font-black uppercase tracking-widest shadow-sm border border-black/5 ${isOffline ? 'text-slate-400' : (color === 'rose' ? 'text-rose-500' : 'text-blue-500')}">
            ${name}
          </span>
        </div>
      </div>
    `,
    iconSize: [48, 60],
    iconAnchor: [24, 60],
  }), [imageUrl, isOffline, color, pingColor, pulseBorder, cleanedAddress]);

  return (
    <SmoothMarker position={position} icon={icon}>
      <Popup className="custom-popup" offset={[0, -45]}>
        <div className="p-3 w-48 text-center">
          <div className="w-12 h-12 mx-auto rounded-xl overflow-hidden mb-2 border-2 border-white shadow-md">
             {imageUrl ? <img src={imageUrl} className="w-full h-full object-cover" /> : <div className="w-full h-full bg-slate-100 flex items-center justify-center text-slate-300"><User size={20} /></div>}
          </div>
          <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1">{isOffline ? 'Ngoại tuyến' : 'Đang hoạt động'}</p>
          <h4 className="text-sm font-black text-slate-800">{name}</h4>
          {address && (
             <div className="mt-3 p-2 bg-slate-50 rounded-lg border border-slate-100">
               <p className="text-[9px] font-bold text-slate-500 leading-tight">
                 <MapPin size={8} className="inline mr-1 text-primary" />
                 {cleanAddress(address)}
               </p>
             </div>
          )}
        </div>
      </Popup>
    </SmoothMarker>
  );
};

interface StoryMapProps {
  events: any[];
  config: AppConfig;
  userId?: string;
  userProfile?: any;
  externalSelectedEvent?: any;
  onExternalEventConsumed?: () => void;
  setActiveTab?: (tab: string) => void;
}

export const StoryMap: React.FC<StoryMapProps> = ({ 
  events, 
  config, 
  userId, 
  userProfile, 
  externalSelectedEvent,
  onExternalEventConsumed,
  setActiveTab
}) => {
  const [selectedEvent, setSelectedEvent] = useState<any>(null);
  const [mapType, setMapType] = useState<'standard' | 'hybrid'>('hybrid');
  const { trackedUsers, sortedUsers } = useMapLogic(userId, config);
  const [locationNotice, setLocationNotice] = useState<{name: string, address: string, avatar: string | null} | null>(null);
  const lastAddressesRef = useRef<Record<string, string>>({});

  const [mapProps, setMapProps] = useState<{ center: [number, number], zoom: number }>({
    center: [10.762622, 106.660172],
    zoom: 8
  });
  const [isFollowingOther, setIsFollowingOther] = useState(false);
  const mapRef = useRef<L.Map | null>(null);

  // Monitor location changes for notifications
  useEffect(() => {
    sortedUsers.forEach(user => {
      const prev = lastAddressesRef.current[user.user_id];
      const current = user.address;
      
      if (prev && current && prev !== current && user.isOnline) {
        // Significant change (at least some character diff or first discovery)
        setLocationNotice({
          name: user.name,
          address: current,
          avatar: user.avatar_url
        });
        
        // Auto-dismiss after 6 seconds
        const timer = setTimeout(() => setLocationNotice(null), 6000);
        return () => clearTimeout(timer);
      }
      
      if (current) {
        lastAddressesRef.current[user.user_id] = current;
      }
    });
  }, [sortedUsers]);

  // Auto-follow logic
  useEffect(() => {
    if (!isFollowingOther) return;
    
    const other = sortedUsers.find(u => u.user_id !== userId && u.isOnline);
    if (other && !isNaN(other.lat) && !isNaN(other.lng)) {
      setMapProps({ center: [other.lat, other.lng], zoom: 16 });
    }
  }, [sortedUsers, isFollowingOther, userId]);

  // Filter events that actually have coordinates
  const mapEvents = useMemo(() => {
    return events.filter(e => 
      e.location && 
      e.location.lat !== undefined && e.location.lng !== undefined &&
      !isNaN(Number(e.location.lat)) && !isNaN(Number(e.location.lng))
    );
  }, [events]);

  // Sync with external selection (e.g. from Timeline)
  useEffect(() => {
    if (externalSelectedEvent?.location) {
      const lat = Number(externalSelectedEvent.location.lat);
      const lng = Number(externalSelectedEvent.location.lng);
      if (!isNaN(lat) && !isNaN(lng)) {
        setSelectedEvent(externalSelectedEvent);
        setMapProps({ center: [lat, lng], zoom: 16 });
      }
      if (onExternalEventConsumed) onExternalEventConsumed();
    }
  }, [externalSelectedEvent, onExternalEventConsumed]);

  // Create markers for events
  const eventIcons = useMemo(() => {
    return mapEvents.map(event => ({
      ...event,
      icon: divIcon({
        className: 'story-marker',
        html: `
          <div class="relative group">
            <div class="absolute -inset-1 bg-white/50 rounded-[12px] blur-[2px] group-hover:scale-110 transition-all duration-300"></div>
            <div class="relative w-10 h-10 bg-white rounded-[10px] shadow-xl p-[1.5px] border border-white/50 group-hover:scale-110 transition-transform duration-300">
              <div class="w-full h-full rounded-[8px] overflow-hidden bg-slate-100">
                <img src="${event.photo_url}" class="w-full h-full object-cover" />
              </div>
              <div class="absolute -top-1.5 -right-1.5 w-4 h-4 bg-rose-500 rounded-full flex items-center justify-center text-white border-2 border-white">
                <svg width="8" height="8" viewBox="0 0 24 24" fill="currentColor" stroke="none"><path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z"/></svg>
              </div>
            </div>
            <div class="absolute top-full left-1/2 -translate-x-1/2 pt-1 opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none z-50">
               <span class="px-2 py-1 bg-slate-900/90 text-white text-[8px] font-black uppercase tracking-widest rounded-lg shadow-lg backdrop-blur-sm">
                 ${event.title}
               </span>
            </div>
          </div>
        `,
        iconSize: [40, 40],
        iconAnchor: [20, 40]
      })
    }));
  }, [mapEvents]);

  // Map controls UI
  const Controls = () => {
    const me = trackedUsers[userId || ''];
    const other = sortedUsers.find(u => u.user_id !== userId);

    return (
      <div className="absolute top-6 left-6 z-[1000] flex flex-col gap-3">
        <button 
          onClick={() => setActiveTab?.('timeline')}
          className="w-12 h-12 bg-white/90 backdrop-blur-xl rounded-2xl flex items-center justify-center text-slate-800 shadow-xl border border-white/40 hover:scale-110 active:scale-95 transition-all"
          title="Quay lại Timeline"
        >
          <NavIcon size={20} className="-rotate-90" />
        </button>
        <button 
          onClick={() => setMapType(prev => prev === 'standard' ? 'hybrid' : 'standard')}
          className="w-12 h-12 bg-white/90 backdrop-blur-xl rounded-2xl flex items-center justify-center text-primary shadow-xl border border-white/40 hover:scale-110 active:scale-95 transition-all"
          title={mapType === 'standard' ? "Chuyển sang Vệ tinh" : "Chuyển sang Bản đồ"}
        >
          {mapType === 'standard' ? <Sparkles size={16} /> : <MapPin size={16} />}
        </button>

        {me && (
          <button 
            onClick={() => {
            if (me && !isNaN(me.lat) && !isNaN(me.lng)) {
              setIsFollowingOther(false);
              setMapProps({ center: [me.lat, me.lng], zoom: 17 });
            }
          }}
            className="w-12 h-12 bg-white/90 backdrop-blur-xl rounded-2xl flex items-center justify-center text-blue-500 shadow-xl border border-white/40 hover:scale-110 active:scale-95 transition-all"
            title="Vị trí của tôi"
          >
            <Compass size={20} />
          </button>
        )}

        {other && (
          <button 
            onClick={() => {
            setIsFollowingOther(!isFollowingOther);
            if (!isFollowingOther && other && !isNaN(other.lat) && !isNaN(other.lng)) {
              setMapProps({ center: [other.lat, other.lng], zoom: 17 });
            }
          }}
            className={cn(
              "w-12 h-12 rounded-2xl flex items-center justify-center shadow-xl border transition-all relative overflow-hidden group",
              isFollowingOther 
                ? "bg-rose-500 text-white border-rose-400 scale-110" 
                : "bg-white/90 backdrop-blur-xl text-rose-500 border-white/40 hover:scale-110"
            )}
            title={isFollowingOther ? "Đang theo dõi..." : `Theo dõi ${other.name}`}
          >
            <Eye size={20} className={isFollowingOther ? "animate-pulse" : ""} />
            {other.isOnline && !isFollowingOther && (
              <div className="absolute top-2 right-2 w-2 h-2 bg-green-500 rounded-full border border-white"></div>
            )}
          </button>
        )}
      </div>
    );
  };

  return (
    <div className="relative w-full h-full overflow-hidden bg-slate-900">
      <Controls />

      {/* Real-time Location Notification */}
      <AnimatePresence>
        {locationNotice && (
          <motion.div
            initial={{ opacity: 0, x: -50, scale: 0.9 }}
            animate={{ opacity: 1, x: 0, scale: 1 }}
            exit={{ opacity: 0, x: -50, scale: 0.9 }}
            className="absolute top-6 left-24 z-[1001] md:left-32"
          >
            <div className="bg-white/95 backdrop-blur-xl px-4 py-3 rounded-2xl shadow-2xl border border-white/50 flex items-center gap-3 animate-pulse-subtle">
              <div className="w-10 h-10 rounded-xl overflow-hidden shadow-sm border-2 border-white flex-shrink-0">
                {locationNotice.avatar ? (
                  <img src={locationNotice.avatar} className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full bg-slate-100 flex items-center justify-center text-slate-300">
                    <User size={16} />
                  </div>
                )}
              </div>
              <div className="flex flex-col min-w-0">
                <span className="text-[10px] font-black text-rose-500 uppercase tracking-widest leading-none mb-1">Cập nhật vị trí</span>
                <span className="text-[11px] font-bold text-slate-800 leading-tight">
                  <span className="text-primary">{locationNotice.name}</span> đang ở:
                </span>
                <span className="text-[10px] font-medium text-slate-500 truncate max-w-[200px]">
                  {locationNotice.address}
                </span>
              </div>
              <button 
                onClick={() => setLocationNotice(null)}
                className="p-1 hover:bg-slate-100 rounded-full text-slate-300 transition-colors"
              >
                <X size={14} />
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <MapContainer 
        ref={mapRef}
        center={mapProps.center} 
        zoom={mapProps.zoom} 
        className="w-full h-full z-0"
        zoomControl={false}
      >
        {mapType === 'standard' ? (
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />
        ) : (
          <TileLayer
            attribution='&copy; Google'
            url="https://{s}.google.com/vt/lyrs=y&x={x}&y={y}&z={z}"
            subdomains={['mt0', 'mt1', 'mt2', 'mt3']}
            maxZoom={20}
          />
        )}
        <ZoomControl position="bottomright" />
        <MapViewHandler center={mapProps.center} zoom={mapProps.zoom} />

        {/* Real-time Users */}
        {sortedUsers.map((u) => (
          <UserMarker
            key={u.user_id}
            position={[u.lat, u.lng]}
            name={u.name}
            imageUrl={u.avatar_url}
            isOffline={!u.isOnline}
            color={u.user_id === userId ? 'blue' : 'rose'}
            address={u.address}
          />
        ))}

        <MarkerClusterGroup
          chunkedLoading
          showCoverageOnHover={false}
          maxClusterRadius={40}
          iconCreateFunction={(cluster) => {
            return divIcon({
              html: `<div class="w-10 h-10 bg-primary/90 backdrop-blur-md rounded-full flex items-center justify-center text-white text-[11px] font-black border-2 border-white shadow-xl">${cluster.getChildCount()}</div>`,
              className: 'custom-clustericon',
              iconSize: [40, 40]
            });
          }}
        >
          {eventIcons.map((event) => (
            <Marker 
              key={event.id}
              position={[event.location.lat, event.location.lng]} 
              icon={event.icon}
              eventHandlers={{
                click: () => {
                  const lat = Number(event.location.lat);
                  const lng = Number(event.location.lng);
                  if (!isNaN(lat) && !isNaN(lng)) {
                    setSelectedEvent(event);
                    setMapProps({ center: [lat, lng], zoom: 16 });
                  }
                },
              }}
            />
          ))}
        </MarkerClusterGroup>
      </MapContainer>

      {/* Floating Info Card */}
      <AnimatePresence>
        {selectedEvent && (
          <motion.div
            initial={{ opacity: 0, y: 100, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 100, scale: 0.95 }}
            className="absolute bottom-12 left-6 right-6 md:left-auto md:right-12 md:w-96 z-[1000]"
          >
            <div className="bg-white/95 backdrop-blur-2xl rounded-[2.5rem] p-6 shadow-2xl border border-white/50 relative overflow-hidden group">
              <div className="absolute top-5 right-5 z-10">
                <button 
                  onClick={() => setSelectedEvent(null)}
                  className="w-10 h-10 rounded-full bg-slate-50 flex items-center justify-center text-slate-400 hover:bg-slate-100 transition-colors"
                >
                  <X size={18} />
                </button>
              </div>

              <div className="flex gap-5">
                <div className="w-28 h-28 rounded-3xl overflow-hidden shadow-lg border-2 border-white flex-shrink-0 group-hover:scale-105 transition-transform duration-500">
                  <img src={selectedEvent.photo_url} className="w-full h-full object-cover" />
                </div>
                <div className="flex-grow min-w-0 pt-1">
                  <div className="flex items-center gap-2 text-primary/60 mb-2">
                    <Calendar size={12} strokeWidth={3} />
                    <span className="text-[10px] font-black uppercase tracking-widest">{formatDate(selectedEvent.date)}</span>
                  </div>
                  <h3 className="text-lg font-black text-slate-800 tracking-tight leading-tight mb-2 truncate">{selectedEvent.title}</h3>
                  <div className="flex items-center gap-2">
                    <div className="flex -space-x-2">
                      <div className="w-6 h-6 rounded-full border-2 border-white bg-rose-100 flex items-center justify-center text-rose-500">
                        <Heart size={10} fill="currentColor" />
                      </div>
                    </div>
                    <span className="text-[11px] font-bold text-slate-400">Khoảnh khắc đáng nhớ</span>
                  </div>
                </div>
              </div>

              <div className="mt-5 p-4 bg-slate-50/80 rounded-2xl border border-slate-100/50">
                <p className="text-xs font-medium text-slate-600 line-clamp-2 italic leading-relaxed mb-4">
                  "{selectedEvent.description}"
                </p>
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-white shadow-sm flex items-center justify-center text-primary/70 border border-slate-50">
                    <MapPin size={18} />
                  </div>
                  <div className="min-w-0 flex-grow">
                    <p className="text-[9px] font-black uppercase tracking-widest text-slate-300">Nơi lưu dấu</p>
                    <p className="text-[11px] font-bold text-slate-600 truncate">{cleanAddress(selectedEvent.location?.address_name)}</p>
                  </div>
                </div>
              </div>

              <button 
                onClick={() => setActiveTab?.('timeline')}
                className="mt-5 w-full py-4 bg-slate-900 text-white rounded-2xl text-[10px] font-black uppercase tracking-[0.2em] shadow-xl shadow-slate-900/20 hover:bg-slate-800 transition-all flex items-center justify-center gap-2 group"
              >
                <span>Xem chi tiết câu chuyện</span>
                <ChevronRight size={14} className="group-hover:translate-x-1 transition-transform" />
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};
