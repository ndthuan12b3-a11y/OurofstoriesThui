import React, { useState, useMemo, useEffect } from 'react';
import { MapContainer, TileLayer, Marker, Popup, useMap, Tooltip, Circle, Polyline } from 'react-leaflet';
import L, { Icon, divIcon } from 'leaflet';
import MarkerClusterGroup from 'react-leaflet-cluster';
import { motion, AnimatePresence } from 'motion/react';
import { MapPin, Calendar, BookOpen, X, Maximize2, Minimize2, Navigation as NavIcon, ChevronRight, List, Zap, User, Plus, Minus, Home } from 'lucide-react';
import { AppConfig, Database } from '../types';
import { getOptimizedImageUrl } from '../lib/imageUtils';
import { useMapLogic, TrackedUser } from '../hooks/useMapLogic';
import { showNotification } from '../lib/notifications';

type Event = Database['public']['Tables']['events']['Row'];

// Regular marker icon
const defaultIcon = new Icon({
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
  iconSize: [25, 41],
  iconAnchor: [12, 41]
});

// Fix for default Leaflet icon inclusion
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
});

// Helper to validate coordinates
const isValidCoords = (coords: any): coords is [number, number] => {
  if (!Array.isArray(coords) || coords.length !== 2) return false;
  const lat = Number(coords[0]);
  const lng = Number(coords[1]);
  return typeof lat === 'number' && !isNaN(lat) && isFinite(lat) &&
         typeof lng === 'number' && !isNaN(lng) && isFinite(lng);
};

// Smooth Marker with interpolation
const SmoothMarker = ({ position, icon, children }: { 
  position: [number, number], 
  icon: L.DivIcon | L.Icon, 
  children?: React.ReactNode 
}) => {
  const markerRef = React.useRef<L.Marker | null>(null);
  const targetPosRef = React.useRef(position);
  const currentPosRef = React.useRef(position);
  const requestRef = React.useRef<number | undefined>(undefined);

  React.useEffect(() => {
    if (!isValidCoords(position)) return; // Don't animate to invalid positions
    let isSubscribed = true;
    targetPosRef.current = position;
    
    const animate = () => {
      if (!isSubscribed) return;
      const [curLat, curLng] = currentPosRef.current;
      const [tarLat, tarLng] = targetPosRef.current;
      
      if (isNaN(curLat) || isNaN(curLng) || isNaN(tarLat) || isNaN(tarLng)) {
        if (markerRef.current && isValidCoords(targetPosRef.current)) {
          markerRef.current.setLatLng(targetPosRef.current);
          currentPosRef.current = targetPosRef.current;
        }
        requestRef.current = undefined;
        return;
      }

      const dfLat = tarLat - curLat;
      const dfLng = tarLng - curLng;
      const factor = 0.04; // Animation speed
      
      if (Math.abs(dfLat) < 0.0000001 && Math.abs(dfLng) < 0.0000001) {
        if (markerRef.current) {
          try {
            markerRef.current.setLatLng(targetPosRef.current);
          } catch(e) {}
        }
        currentPosRef.current = targetPosRef.current;
        requestRef.current = undefined;
        return;
      }
      
      const nextPos: [number, number] = [
        curLat + dfLat * factor,
        curLng + dfLng * factor
      ];
      
      if (markerRef.current) {
        try {
          markerRef.current.setLatLng(nextPos);
        } catch(e) {}
      }
      currentPosRef.current = nextPos;
      requestRef.current = requestAnimationFrame(animate);
    };

    if (!requestRef.current) {
      requestRef.current = requestAnimationFrame(animate);
    }
    
    return () => {
      isSubscribed = false;
      if (requestRef.current) {
        cancelAnimationFrame(requestRef.current);
        requestRef.current = undefined;
      }
    };
  }, [position]);

  return (
    <Marker 
      position={currentPosRef.current} 
      icon={icon}
      ref={(ref) => { markerRef.current = ref; }}
    >
      {children}
    </Marker>
  );
};

// Custom marker with image
const CustomMarker = React.memo(({ id, position, imageUrl, isOffline, color = 'rose', address }: { 
  id: string,
  position: [number, number], 
  imageUrl: string, 
  isOffline?: boolean,
  color?: 'rose' | 'blue',
  address?: string | null
}) => {
  if (!isValidCoords(position)) return null;
  const pingColor = color === 'rose' ? 'bg-rose-400/20' : 'bg-blue-400/20';
  const pulseBorder = color === 'rose' ? 'border-rose-400/30' : 'border-blue-400/30';

  const icon = useMemo(() => divIcon({
    className: 'custom-div-icon',
    html: `
      <div class="relative group animate-marker-breath flex flex-col items-center w-12 h-[60px]" style="will-change: transform;">
        <div class="relative w-12 h-12 bg-white rounded-[14px] shadow-xl z-20 flex items-center justify-center p-[2px]" style="border: 3px solid ${color === 'rose' ? '#fb7185' : '#60a5fa'}">
          <div style="width: 100%; height: 100%; border-radius: 9px; overflow: hidden; background-color: #f3f4f6; position: relative;">
            <img src="${encodeURI(imageUrl)}" style="width: 100%; height: 100%; object-fit: cover;" onerror="this.style.display='none'" />
          </div>
          ${!isOffline ? `
            <div class="absolute -right-1.5 -top-1.5 w-3.5 h-3.5 bg-green-500 rounded-full border-2 border-white z-30"></div>
          ` : ''}
        </div>
        <!-- Triangle Tail -->
        <div class="w-0 h-0 border-l-[6px] border-l-transparent border-r-[6px] border-r-transparent border-t-[8px]" style="border-top-color: ${color === 'rose' ? '#fb7185' : '#60a5fa'}; margin-top: -1px; z-index: 10;"></div>
        
        ${!isOffline ? `
          <div class="absolute top-0 left-0 w-12 h-12 rounded-[14px] ${pingColor} animate-ping -z-10"></div>
          <div class="absolute -inset-[2px] rounded-[16px] border-2 ${pulseBorder} animate-marker-pulse -z-10"></div>
        ` : ''}
      </div>
    `,
    iconSize: [48, 60],
    iconAnchor: [24, 60],
  }), [imageUrl, isOffline, color, pingColor, pulseBorder]);

  return (
    <SmoothMarker position={position} icon={icon}>
      <Popup className="custom-user-popup">
        <div className="p-3 min-w-[180px] flex flex-col items-center text-center">
          <div className="w-14 h-14 rounded-2xl border-4 border-white shadow-xl overflow-hidden mb-3 relative">
            <img src={imageUrl} className="w-full h-full object-cover" alt="" />
            {!isOffline && (
              <div className="absolute bottom-0 right-0 w-4 h-4 bg-green-500 border-2 border-white rounded-full"></div>
            )}
          </div>
          <div className="space-y-2">
             <div className="flex flex-col gap-1">
                {address ? (
                  <p className="text-[11px] font-black text-gray-900 leading-tight bg-gray-50 p-2 rounded-xl border border-gray-100">
                    {address}
                  </p>
                ) : (
                  <p className="text-[10px] text-gray-400 italic">
                    {isOffline ? 'Không tìm thấy địa chỉ' : 'Đang xác định vị trí...'}
                  </p>
                )}
                {!isOffline && (
                  <button 
                    onClick={async (e) => {
                      e.stopPropagation();
                      try {
                        await fetch('/api/location/update', {
                          method: 'POST',
                          headers: { 'Content-Type': 'application/json' },
                          body: JSON.stringify({ user_id: id, lat: position[0], lng: position[1] })
                        });
                        showNotification("Đang làm mới địa chỉ...");
                      } catch (err) {}
                    }}
                    className="text-[8px] font-black text-primary uppercase tracking-widest mt-1 hover:underline"
                  >
                    Làm mới địa chỉ
                  </button>
                )}
             </div>
             <div className="pt-1 border-t border-gray-100">
               <p className="text-[9px] text-rose-500 font-bold tracking-tighter">
                 {position[0].toFixed(6)}, {position[1].toFixed(6)}
               </p>
             </div>
          </div>
        </div>
      </Popup>
    </SmoothMarker>
  );
});

// Memory Marker component for mapping events
const MemoryMarker = React.memo(({ item, onSelect }: { item: Event, onSelect: (item: Event, pos: [number, number]) => void }) => {
  const pos = useMemo(() => [Number(item.location!.lat), Number(item.location!.lng)] as [number, number], [item.location]);
  
  const icon = useMemo(() => L.divIcon({
    className: 'memory-marker',
    html: `
      <svg width="40" height="40" viewBox="0 0 40 40" class="group transition-transform active:scale-95">
        <defs>
          <clipPath id="circleView">
            <rect x="4" y="4" width="32" height="32" rx="10" />
          </clipPath>
          <filter id="shadow" x="-20%" y="-20%" width="140%" height="140%">
            <feGaussianBlur in="SourceAlpha" stdDeviation="2"/>
            <feOffset dx="0" dy="2" result="offsetblur"/>
            <feComponentTransfer><feFuncA type="linear" slope="0.3"/></feComponentTransfer>
            <feMerge><feMergeNode/><feMergeNode in="SourceGraphic"/></feMerge>
          </filter>
        </defs>
        <path d="M20 40 L16 34 L24 34 Z" fill="white" />
        <rect x="2" y="2" width="36" height="36" rx="12" fill="white" filter="url(#shadow)" />
        <image 
          href="${getOptimizedImageUrl(item.photo_url, 100)}" 
          x="4" y="4" width="32" height="32" 
          clip-path="url(#circleView)"
          preserveAspectRatio="xMidYMid slice"
        />
      </svg>
    `,
    iconSize: [40, 40],
    iconAnchor: [20, 40]
  }), [item.photo_url]);

  if (!isValidCoords(pos)) return null;

  return (
    <Marker 
      position={pos}
      icon={icon}
      eventHandlers={{
        click: () => onSelect(item, pos)
      }}
    >
      <Popup className="custom-popup">
        <div className="w-48 overflow-hidden rounded-2xl">
          <img 
            src={getOptimizedImageUrl(item.photo_url, 400)} 
            alt={item.title}
            className="w-full h-32 object-cover"
          />
          <div className="p-3">
            <p className="text-[8px] font-black text-rose-400 uppercase tracking-widest leading-none mb-1">
              {new Date(item.date).toLocaleDateString('vi-VN')}
            </p>
            <h4 className="text-xs font-black text-gray-800 line-clamp-1 mb-1 uppercase tracking-tight">{item.title}</h4>
            <p className="text-[10px] text-gray-500 line-clamp-2 leading-tight">{(item.location as any)?.address_name || item.description}</p>
          </div>
        </div>
      </Popup>
    </Marker>
  );
});

interface StoryMapProps {
  events: Event[];
  config: AppConfig;
  userId?: string;
  userProfile?: { id: string, avatar_url: string | null } | null;
  externalSelectedEvent?: Event | null;
  onExternalEventConsumed?: () => void;
  setActiveTab?: (tab: string) => void;
}

const ZoomControl = () => {
  const map = useMap();
  return (
    <div className="absolute bottom-6 right-4 md:bottom-10 md:right-6 z-[1000] flex flex-col gap-2">
      <button 
        onClick={() => map.zoomIn()}
        className="w-8 h-8 md:w-10 md:h-10 bg-white/90 backdrop-blur-sm shadow-xl rounded-xl md:rounded-2xl flex items-center justify-center text-gray-800 hover:bg-gray-50 active:scale-95 transition-all"
      >
        <Plus size={18} />
      </button>
      <button 
        onClick={() => map.zoomOut()}
        className="w-8 h-8 md:w-10 md:h-10 bg-white/90 backdrop-blur-sm shadow-xl rounded-xl md:rounded-2xl flex items-center justify-center text-gray-800 hover:bg-gray-50 active:scale-95 transition-all"
      >
        <Minus size={18} />
      </button>
    </div>
  );
};

// Removed helper and moved up

// Component to automatically fit the map view to show both markers
const FitBoundsComponent = ({ 
  userLoc, 
  otherLoc, 
  isOtherOnline,
  refocusKey 
}: { 
  userLoc: [number, number] | null, 
  otherLoc: [number, number] | null,
  isOtherOnline: boolean,
  refocusKey: number
}) => {
  const map = useMap();
  const lastKeyRef = React.useRef(-1);

  const points = useMemo(() => {
    const pts: [number, number][] = [];
    if (userLoc && isValidCoords(userLoc)) pts.push(userLoc);
    if (otherLoc && isValidCoords(otherLoc)) pts.push(otherLoc);
    return pts;
  }, [userLoc, otherLoc]);

  React.useEffect(() => {
    if (points.length === 0) return;

    // Trigger on initial load (points exist) or when refocus button clicked
    if (refocusKey !== lastKeyRef.current) {
      const isInitial = lastKeyRef.current === -1;
      lastKeyRef.current = refocusKey;
      
      if (points.length === 1) {
        try {
          map.flyTo(points[0], 16, { 
            duration: 2,
            easeLinearity: 0.1
          });
        } catch (e) {}
      } else {
        try {
          const bounds = L.latLngBounds(points);
          map.fitBounds(bounds, { 
            padding: [70, 70], 
            maxZoom: 16, 
            duration: 2,
            easeLinearity: 0.1
          });
        } catch (e) {}
      }
    }
  }, [refocusKey, points, map]);

  return null;
};

// Component to handle external "FlyTo" commands
const FlyToController = ({ target }: { target: [number, number] | null }) => {
  const map = useMap();
  React.useEffect(() => {
    if (target && isValidCoords(target)) {
      try {
        map.flyTo(target, 17, {
          duration: 1.5,
          easeLinearity: 0.1
        });
      } catch (e) {
        console.error("FlyTo error:", e);
      }
    }
  }, [target, map]);
  return null;
};

// Component to recalibrate map size after layout changes
const InvalidateSizeHandler = ({ trigger }: { trigger: any }) => {
  const map = useMap();
  React.useEffect(() => {
    let timeoutId: NodeJS.Timeout;
    if (map) {
      timeoutId = setTimeout(() => {
        try {
          map.invalidateSize();
        } catch (e) {
          // Ignore if map is unmounted
        }
      }, 500); // Wait for transition animation to finish
    }
    return () => {
      if (timeoutId) clearTimeout(timeoutId);
    };
  }, [trigger, map]);
  return null;
};

// Removed old MapController

export const StoryMap: React.FC<StoryMapProps> = ({ 
  events, config, userId, userProfile, externalSelectedEvent, onExternalEventConsumed, setActiveTab 
 }) => {
  const { 
    trackedUsers, 
    sortedUsers, 
    userLocation, 
    otherLocation, 
    isOtherOnline, 
    distance, 
    onlineUsers 
  } = useMapLogic(userId, config);

  const [isFullscreen, setIsFullscreen] = useState(false);
  const [showList, setShowList] = useState(true);
  const [selectedItem, setSelectedItem] = useState<Event | null>(null);
  const [flyToCoords, setFlyToCoords] = useState<[number, number] | null>(null);
  const [refocusKey, setRefocusKey] = useState(0);

  // Handle external selection
  useEffect(() => {
    if (externalSelectedEvent && externalSelectedEvent.location) {
      const lat = Number(externalSelectedEvent.location.lat);
      const lng = Number(externalSelectedEvent.location.lng);
      if (!isNaN(lat) && !isNaN(lng)) {
        setFlyToCoords([lat, lng]);
        setSelectedItem(externalSelectedEvent);
        if (onExternalEventConsumed) onExternalEventConsumed();
      }
    }
  }, [externalSelectedEvent, onExternalEventConsumed]);

  const formatTime = (isoString: string) => {
    if (!isoString) return '';
    let dateStr = isoString;
    if (!dateStr.endsWith('Z') && !dateStr.includes('+')) {
      dateStr += 'Z';
    }
    const date = new Date(dateStr);
    const now = new Date();
    const diff = Math.floor((now.getTime() - date.getTime()) / 1000);
    if (diff < 60) return 'vừa xong';
    if (diff < 3600) return `${Math.floor(diff / 60)} phút trước`;
    return date.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' });
  };

  // Filter items that have location and valid coordinates
  const mapItems = useMemo(() => {
    return events.filter(e => {
      if (!e.location) return false;
      const lat = Number(e.location.lat);
      const lng = Number(e.location.lng);
      return !isNaN(lat) && !isNaN(lng);
    });
  }, [events]);

  // Screen Wake Lock to keep the map alive
  React.useEffect(() => {
    let wakeLock: any = null;
    const requestWakeLock = async () => {
      try {
        if ('wakeLock' in navigator) {
          // Check if permissions policy allows wake-lock
          // @ts-ignore
          if (document.featurePolicy && !document.featurePolicy.allowsFeature('screen-wake-lock')) {
            return;
          }
          wakeLock = await (navigator as any).wakeLock.request('screen');
        }
      } catch (err: any) {
        // Silently skip if disallowed by policy or not supported
        if (err.name !== 'NotAllowedError') {
          console.warn('WakeLock request failed:', err.message);
        }
      }
    };

    if (isFullscreen) {
      requestWakeLock();
    }

    return () => {
      if (wakeLock !== null) {
        wakeLock.release().then(() => {
          wakeLock = null;
        });
      }
    };
  }, [isFullscreen]);

  // Optimized Select Handlers
  const handleSelectFromList = React.useCallback((item: Event) => {
    if (!item.location) return;
    const lat = Number(item.location.lat);
    const lng = Number(item.location.lng);
    if (!isNaN(lat) && !isNaN(lng)) {
      setFlyToCoords([lat, lng]);
      setSelectedItem(item);
      if (window.innerWidth < 768) setShowList(false);
    }
  }, []);

  const handleSelectLiveLocation = React.useCallback((coords: [number, number], label: string) => {
    setFlyToCoords(coords);
    if (window.innerWidth < 768) setShowList(false);
  }, []);

  return (
    <div className={`relative transition-all duration-500 overflow-hidden flex flex-col md:flex-row ${isFullscreen ? 'fixed inset-0 z-[1500] h-[100dvh] w-screen bg-white' : 'h-[600px] md:h-[700px] rounded-none shadow-2xl border border-white/20 bg-white/40 backdrop-blur-xl'}`}>
      
      {/* Memories List - Responsive Layout */}
      <motion.div 
        initial={false}
        animate={{ 
          width: window.innerWidth >= 768 ? (showList ? (isFullscreen ? '300px' : '260px') : '0px') : '100%',
          height: window.innerWidth < 768 ? (showList ? '280px' : '0px') : '100%',
          opacity: showList ? 1 : 0,
          display: !showList && window.innerWidth >= 768 ? 'none' : 'flex'
        }}
        className="relative bg-white/50 backdrop-blur-2xl border-r md:border-r border-b md:border-b-0 border-white/30 overflow-hidden flex flex-col z-10 shrink-0"
      >
        <div className="p-3 border-b border-white/20 flex items-center justify-between bg-white/40">
          <div className="flex items-center gap-3">
            <h3 className="text-[10px] font-black text-gray-800 uppercase tracking-[0.2em] flex items-center gap-2">
              <Zap size={12} className="text-rose-500" /> TRỰC TIẾP
            </h3>
            
            <div className="flex items-center gap-1 ml-2">
              {setActiveTab && (
                <motion.button
                  whileHover={{ scale: 1.1, backgroundColor: 'rgba(0,0,0,0.05)' }}
                  whileTap={{ scale: 0.9 }}
                  onClick={() => setActiveTab('home')}
                  className="w-7 h-7 flex items-center justify-center rounded-lg text-gray-500 hover:text-primary transition-all"
                  title="Trang chủ"
                >
                  <Home size={14} />
                </motion.button>
              )}
              <motion.button
                whileHover={{ scale: 1.1, backgroundColor: 'rgba(0,0,0,0.05)' }}
                whileTap={{ scale: 0.9 }}
                onClick={() => {
                  if (!isOtherOnline) {
                    showNotification('Người ấy chưa online', true);
                    return;
                  }
                  if (otherLocation && isValidCoords(otherLocation)) {
                    setFlyToCoords(otherLocation);
                  } else {
                    showNotification('Không tìm thấy vị trí người ấy', true);
                  }
                }}
                className="w-7 h-7 flex items-center justify-center rounded-lg text-gray-500 hover:text-rose-500 transition-all"
                title="Tìm người ấy"
              >
                <Zap size={14} />
              </motion.button>
            </div>
          </div>
          <button 
            onClick={() => setShowList(false)} 
            className="flex items-center gap-1.5 px-3 py-1.5 bg-rose-500/10 hover:bg-rose-500/20 text-rose-500 rounded-xl transition-all duration-300 group"
            title="Ẩn danh sách"
          >
            <span className="text-[9px] font-black uppercase tracking-[0.15em] whitespace-nowrap">Ẩn danh sách</span>
            <X size={14} className="group-hover:rotate-90 transition-transform duration-300" />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto p-2.5 space-y-5 no-scrollbar">
          {/* Live Section - More compact and horizontal-friendly */}
          <div className="space-y-1.5">
            <div className="grid grid-cols-1 gap-1.5">
              {sortedUsers.map(user => (
                <motion.button
                  key={user.user_id}
                  whileHover={{ x: 2 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={() => handleSelectLiveLocation([user.lat, user.lng], user.name)}
                  className={`w-full px-2 py-1.5 rounded-xl border transition-all flex items-center gap-2 ${onlineUsers.includes(user.user_id) ? 'bg-rose-50/40 border-rose-100/50 shadow-sm shadow-rose-100/20' : 'bg-white/40 border-transparent hover:bg-white/60'}`}
                >
                  <div className={`w-8 h-8 rounded-lg overflow-hidden shadow-sm border ${onlineUsers.includes(user.user_id) ? 'border-rose-400' : 'border-gray-200'} bg-white shrink-0`}>
                    <img src={user.avatar_url || 'https://placehold.co/80x80?text=' + user.name.charAt(0)} className="w-full h-full object-cover" alt={user.name} />
                  </div>
                  <div className="flex-1 min-w-0 text-left">
                    <div className="flex items-center justify-between gap-1">
                      <h4 className="text-[10px] font-black text-gray-800 truncate">
                        {user.user_id === userId ? 'Bạn' : user.name}
                      </h4>
                      {onlineUsers.includes(user.user_id) ? (
                        <div className="flex items-center gap-1.5">
                          <span className="text-[7px] font-black text-green-500 uppercase tracking-tighter">Live</span>
                          <span className="relative flex h-1.5 w-1.5">
                            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
                            <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-green-500"></span>
                          </span>
                        </div>
                      ) : (
                        <span className="text-[7px] font-black text-gray-400 shrink-0 uppercase tracking-tighter bg-gray-100/50 px-1 rounded">{formatTime(user.updated_at)}</span>
                      )}
                    </div>
                    <div className="flex flex-col gap-0.5 mt-1">
                      <p className={`text-[10px] leading-tight font-black tracking-tight ${!user.address ? 'text-gray-400' : 'text-gray-900 bg-gray-900/5 px-1.5 py-0.5 rounded-md inline-block'}`}>
                        {user.address || (onlineUsers.includes(user.user_id) ? `Đang tìm số nhà...` : `${user.lat.toFixed(5)}, ${user.lng.toFixed(5)}`)}
                      </p>
                      {user.user_id !== userId && distance && (
                        <p className="text-[9px] font-black text-rose-500 flex items-center gap-1 tracking-tighter mt-0.5">
                          <NavIcon size={8} className="rotate-45 shrink-0" /> Cách bạn {distance}
                        </p>
                      )}
                    </div>
                  </div>
                </motion.button>
              ))}
            </div>
          </div>

          {/* Memories Section - Sleeker rows */}
          <div className="space-y-2">
            <div className="flex items-center justify-between px-2 mb-2">
              <p className="text-[9px] font-black text-gray-400 uppercase tracking-widest">Lưu trữ</p>
              <span className="text-[8px] font-black text-gray-300 bg-gray-50 px-1.5 py-0.5 rounded-md border border-gray-100">{mapItems.length}</span>
            </div>
            <div className="grid grid-cols-1 gap-1">
              {mapItems.map(item => (
                <motion.button
                  key={item.id}
                  whileHover={{ x: 2 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={() => handleSelectFromList(item)}
                  className={`w-full p-1.5 rounded-lg flex items-center gap-2 text-left transition-all ${selectedItem?.id === item.id ? 'bg-rose-500 text-white shadow-lg shadow-rose-200' : 'bg-white/30 hover:bg-white/60 text-gray-700'}`}
                >
                  <div className="w-8 h-8 rounded-md overflow-hidden bg-gray-100 shrink-0">
                    <img 
                      src={getOptimizedImageUrl(item.photo_url, 80)} 
                      className="w-full h-full object-cover" 
                      alt=""
                    />
                  </div>
                  <div className="flex-1 min-w-0">
                    <h4 className={`text-[9px] font-black truncate leading-none mb-1 ${selectedItem?.id === item.id ? 'text-white' : 'text-gray-800'}`}>
                      {item.title}
                    </h4>
                    <p className={`text-[8px] truncate font-medium ${selectedItem?.id === item.id ? 'text-rose-100' : 'text-gray-400'}`}>
                      {new Date(item.date).toLocaleDateString('vi', { day: '2-digit', month: '2-digit' })} • {(item.location as any)?.address_name || 'Không rõ địa chỉ'}
                    </p>
                  </div>
                </motion.button>
              ))}
            </div>
          </div>
        </div>
      </motion.div>

      {/* Map Content */}
      <div className="relative flex-1 min-h-[400px] h-full overflow-hidden">
        {/* HUD Controls - Minimal & Transparent */}
        <div className="absolute top-4 left-4 right-4 md:top-6 md:left-6 md:right-6 z-[1000] flex items-center justify-between pointer-events-none">
          <div className="flex items-center gap-2 pointer-events-auto">
            {!showList && (
              <motion.button
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                whileHover={{ scale: 1.05, backgroundColor: 'rgba(255,255,255,0.4)' }}
                whileTap={{ scale: 0.95 }}
                onClick={() => setShowList(true)}
                className="h-9 px-4 bg-white/20 backdrop-blur-xl border border-white/30 rounded-2xl flex items-center gap-2 shadow-xl shadow-black/5 text-gray-800 transition-all duration-300"
              >
                <List size={16} />
                <span className="text-[9px] font-black uppercase tracking-widest">Hiện danh sách</span>
              </motion.button>
            )}
          </div>

          <div className="flex items-center gap-1.5 p-1 bg-white/10 backdrop-blur-xl rounded-full border border-white/20 shadow-xl shadow-black/5 pointer-events-auto">
            <button 
              onClick={() => setIsFullscreen(!isFullscreen)}
              className="w-8 h-8 flex items-center justify-center rounded-full text-gray-600 hover:bg-white/20 transition-all"
              title={isFullscreen ? "Thu nhỏ" : "Toàn màn hình"}
            >
              {isFullscreen ? <Minimize2 size={16} /> : <Maximize2 size={16} />}
            </button>
            {isFullscreen && (
              <button 
                onClick={() => setIsFullscreen(false)}
                className="w-8 h-8 flex items-center justify-center rounded-full text-rose-500 hover:bg-rose-500/10 transition-all"
              >
                <X size={16} />
              </button>
            )}
          </div>
        </div>

        <MapContainer
          center={[10.762622, 106.660172]}
          zoom={13}
          style={{ height: '100%', width: '100%', zIndex: 0 }}
          zoomControl={false}
          preferCanvas={true}
        >
          <TileLayer
            attribution="&copy; <a href='https://www.openstreetmap.org/copyright'>OpenStreetMap</a> contributors"
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />

          <InvalidateSizeHandler trigger={showList || isFullscreen} />

          <FlyToController target={flyToCoords} />
          
          <MarkerClusterGroup
            chunkedLoading
            maxClusterRadius={50}
          >
            {mapItems.map((item) => (
              <MemoryMarker 
                key={item.id} 
                item={item} 
                onSelect={(selected, pos) => {
                  setSelectedItem(selected);
                  setFlyToCoords(pos);
                }}
              />
            ))}
          </MarkerClusterGroup>

          {/* Line connecting the two users */}
          {userLocation && otherLocation && isOtherOnline && isValidCoords(userLocation) && isValidCoords(otherLocation) && (
            <Polyline 
              positions={[userLocation, otherLocation]}
              pathOptions={{ 
                color: '#f43f5e', 
                weight: 2, 
                dashArray: '10, 10', 
                opacity: 0.4,
                lineCap: 'round'
              }}
            />
          )}

          {/* Fit Bounds logic moved to a sub-component */}
          <FitBoundsComponent 
            userLoc={userLocation} 
            otherLoc={otherLocation} 
            isOtherOnline={isOtherOnline}
            refocusKey={refocusKey}
          />

          {/* Render markers for all tracked users */}
          {Object.values(trackedUsers).map(user => (
            <CustomMarker
              key={user.user_id}
              id={user.user_id}
              position={[user.lat, user.lng]}
              imageUrl={user.avatar_url || 'https://placehold.co/100x100?text=' + user.name.charAt(0)}
              isOffline={!onlineUsers.includes(user.user_id)}
              color={user.user_id === userId ? 'rose' : 'blue'}
              address={user.address}
            />
          ))}

          <ZoomControl />
        </MapContainer>

        {/* Mobile Memory List Toggle */}
        {!showList && (
           <div className="absolute bottom-6 left-4 z-[1000] md:hidden">
              <button 
                onClick={() => setShowList(true)}
                className="w-10 h-10 bg-white/90 backdrop-blur-md rounded-full border border-white shadow-xl text-gray-800 flex items-center justify-center pointer-events-auto"
                title="Xem danh sách"
              >
                <List size={18} />
              </button>
           </div>
        )}
      </div>

      {/* Legend / Info */}
      {!isFullscreen && !showList && (
        <div className="absolute bottom-6 left-6 z-[1000] max-w-[200px] hidden md:block">
          <p className="text-[8px] font-bold text-gray-400 bg-white/50 backdrop-blur-sm px-3 py-1.5 rounded-full inline-block">
            Sử dụng OpenStreetMap & Leaflet
          </p>
        </div>
      )}
    </div>
  );
};
