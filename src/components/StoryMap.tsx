import React, { useState, useMemo } from 'react';
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet';
import L, { Icon, divIcon } from 'leaflet';
import MarkerClusterGroup from 'react-leaflet-cluster';
import { motion, AnimatePresence } from 'motion/react';
import { MapPin, Calendar, BookOpen, X, Maximize2, Minimize2, Navigation as NavIcon, ChevronRight, List, Zap, User } from 'lucide-react';
import { AppConfig, Database } from '../types';
import { getOptimizedImageUrl } from '../lib/imageUtils';
import { supabase } from '../lib/supabase';

type Event = Database['public']['Tables']['events']['Row'];

// Regular marker icon
const defaultIcon = new Icon({
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
  iconSize: [25, 41],
  iconAnchor: [12, 41]
});

// Custom marker with image
const createCustomIcon = (imageUrl: string) => {
  return divIcon({
    className: 'custom-marker',
    html: `
      <div class="relative w-10 h-10 group">
        <div class="absolute -bottom-1 left-1/2 -translate-x-1/2 w-4 h-4 bg-white rotate-45 border-r border-b border-gray-100"></div>
        <div class="w-full h-full rounded-2xl border-4 border-white shadow-lg overflow-hidden group-hover:scale-110 transition-transform bg-rose-50">
          <img src="${imageUrl}" class="w-full h-full object-cover" />
        </div>
      </div>
    `,
    iconSize: [40, 40],
    iconAnchor: [20, 40]
  });
};

interface StoryMapProps {
  events: Event[];
  config: AppConfig;
  userId?: string;
}

const ZoomControl = () => {
  const map = useMap();
  return (
    <div className="absolute bottom-10 right-6 z-[1000] flex flex-col gap-2">
      <button 
        onClick={() => map.zoomIn()}
        className="w-10 h-10 bg-white shadow-xl rounded-2xl flex items-center justify-center text-gray-800 hover:bg-gray-50 active:scale-95 transition-all"
      >
        <Plus size={20} />
      </button>
      <button 
        onClick={() => map.zoomOut()}
        className="w-10 h-10 bg-white shadow-xl rounded-2xl flex items-center justify-center text-gray-800 hover:bg-gray-50 active:scale-95 transition-all"
      >
        <Minus size={20} />
      </button>
    </div>
  );
};

// Component to handle external "FlyTo" commands
const FlyToController = ({ target }: { target: [number, number] | null }) => {
  const map = useMap();
  React.useEffect(() => {
    if (target) {
      map.flyTo(target, 17, {
        duration: 2,
        easeLinearity: 0.25
      });
    }
  }, [target, map]);
  return null;
};

// Component to recalibrate map size after layout changes
const InvalidateSizeHandler = ({ trigger }: { trigger: any }) => {
  const map = useMap();
  React.useEffect(() => {
    setTimeout(() => {
      map.invalidateSize();
    }, 500); // Wait for transition animation to finish
  }, [trigger, map]);
  return null;
};

// Helper component to handle map bounds and view updates
const MapController = ({ 
  userLocation, 
  otherLocation, 
  mapItems 
}: { 
  userLocation: [number, number] | null, 
  otherLocation: [number, number] | null,
  mapItems: any[]
}) => {
  const map = useMap();
  
  React.useEffect(() => {
    // Only fit bounds if we don't have a specific event selected for flyTo
    const points: [number, number][] = [];
    if (userLocation) points.push(userLocation);
    if (otherLocation) points.push(otherLocation);
    
    // Fallback to map items if no live locations
    if (points.length === 0 && mapItems.length > 0) {
      mapItems.forEach(item => {
        if (item.location?.lat && item.location?.lng) {
          points.push([item.location.lat, item.location.lng]);
        }
      });
    }

    if (points.length > 0) {
      const bounds = L.latLngBounds(points);
      map.fitBounds(bounds, { padding: [100, 100], maxZoom: 15 });
    }
  }, [userLocation, otherLocation, map, mapItems]);

  return null;
};

export const StoryMap: React.FC<StoryMapProps> = ({ events, config, userId }) => {
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [showList, setShowList] = useState(false);
  const [selectedItem, setSelectedItem] = useState<Event | null>(null);
  const [flyToCoords, setFlyToCoords] = useState<[number, number] | null>(null);
  const [userLocation, setUserLocation] = useState<[number, number] | null>(null);
  const [otherLocation, setOtherLocation] = useState<[number, number] | null>(null);
  const lastUpdateRef = React.useRef<number>(0);
  const lastPosRef = React.useRef<[number, number] | null>(null);

  // Filter items that have location
  const mapItems = useMemo(() => {
    return events.filter(e => e.location && typeof e.location.lat === 'number');
  }, [events]);

  // Screen Wake Lock to keep the map alive
  React.useEffect(() => {
    let wakeLock: any = null;
    const requestWakeLock = async () => {
      try {
        if ('wakeLock' in navigator) {
          wakeLock = await (navigator as any).wakeLock.request('screen');
        }
      } catch (err) {
        console.error(`${err.name}, ${err.message}`);
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

  // Real-time Location Sharing
  React.useEffect(() => {
    if (!userId || !supabase) return;

    // 1. Setup Realtime Listener for the OTHER person
    const channel = supabase
      .channel('public:locations')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'locations' },
        (payload: any) => {
          const { new: newLoc } = payload;
          if (newLoc && newLoc.id !== userId) {
            setOtherLocation([newLoc.lat, newLoc.lng]);
          }
        }
      )
      .subscribe();

    // 2. Fetch initial location of other person
    const fetchOtherLocation = async () => {
      const { data } = await supabase
        .from('locations')
        .select('*')
        .neq('id', userId)
        .order('updated_at', { ascending: false })
        .limit(1);
      
      if (data && data.length > 0) {
        setOtherLocation([data[0].lat, data[0].lng]);
      }
    };
    fetchOtherLocation();

    // 2b. Handle Visibility Change (Tab focus/blur)
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        fetchOtherLocation();
        // Force an update on re-open
        if ("geolocation" in navigator) {
          navigator.geolocation.getCurrentPosition((pos) => {
             const { latitude, longitude } = pos.coords;
             supabase.from('locations').upsert({
               id: userId,
               lat: latitude,
               lng: longitude,
               updated_at: new Date().toISOString()
             });
          });
        }
      }
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);

    // 3. Watch current position
    let watchId: number;
    if ("geolocation" in navigator) {
      watchId = navigator.geolocation.watchPosition(
        async (position) => {
          const { latitude, longitude } = position.coords;
          const now = Date.now();
          setUserLocation([latitude, longitude]);

          // Throttling: Only update DB every 10s or if moved > 5m
          const shouldUpdate = () => {
            if (!lastPosRef.current) return true;
            if (now - lastUpdateRef.current > 10000) return true;
            
            // Basic distance check (approx)
            const dLat = Math.abs(latitude - lastPosRef.current[0]);
            const dLng = Math.abs(longitude - lastPosRef.current[1]);
            return dLat > 0.00005 || dLng > 0.00005; // ~5 meters
          };

          if (shouldUpdate()) {
            lastUpdateRef.current = now;
            lastPosRef.current = [latitude, longitude];
            
            await supabase.from('locations').upsert({
              id: userId,
              lat: latitude,
              lng: longitude,
              updated_at: new Date().toISOString()
            });
          }
        },
        (error) => {
          console.error("Geolocation error:", error);
          if (error.code === error.PERMISSION_DENIED) {
            alert("Vui lòng bật quyền truy cập vị trí để sử dụng tính năng bản đồ thời gian thực.");
          }
        },
        { enableHighAccuracy: true, maximumAge: 10000, timeout: 5000 }
      );
    }

    return () => {
      if (watchId) navigator.geolocation.clearWatch(watchId);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      supabase.removeChannel(channel);
    };
  }, [userId]);

  const otherIcon = useMemo(() => createCustomIcon(config.avatar_url || 'https://placehold.co/100x100?text=❤️'), [config.avatar_url]);
  const userIcon = divIcon({
    className: 'user-marker',
    html: `<div class="w-4 h-4 bg-blue-500 rounded-full border-2 border-white shadow-lg animate-pulse"></div>`,
    iconSize: [16, 16],
    iconAnchor: [8, 8]
  });

  const handleSelectFromList = (item: Event) => {
    const lat = item.location!.lat;
    const lng = item.location!.lng;
    setFlyToCoords([lat, lng]);
    setSelectedItem(item);
    if (window.innerWidth < 768) setShowList(false); // Close list on mobile after selection
  };

  const handleSelectLiveLocation = (coords: [number, number], label: string) => {
    setFlyToCoords(coords);
    if (window.innerWidth < 768) setShowList(false);
  };

  return (
    <div className={`relative transition-all duration-500 overflow-hidden flex flex-col md:flex-row ${isFullscreen ? 'fixed inset-0 z-[1500] h-screen w-screen' : 'h-[700px] sm:h-[600px] md:h-[700px] rounded-[3rem] shadow-2xl border border-white/50 bg-white/40 backdrop-blur-xl'}`}>
      
      {/* Memories List - Desktop Sidebar / Mobile Bottom Sheet */}
      <motion.div 
        initial={false}
        animate={{ 
          width: showList ? (isFullscreen ? '300px' : '260px') : '0px',
          height: showList && window.innerWidth < 768 ? '260px' : '100%',
          opacity: showList ? 1 : 0
        }}
        className="relative bg-white/30 backdrop-blur-2xl border-r border-white/30 overflow-hidden flex flex-col z-10 shrink-0"
      >
        <div className="p-4 border-b border-white/20">
          <h3 className="text-xs font-black text-gray-800 uppercase tracking-tight flex items-center gap-2">
            <Zap size={14} className="text-rose-500 fill-rose-500 animate-pulse" />
            Live & Kỷ niệm
          </h3>
        </div>
        <div className="flex-1 overflow-y-auto p-2 space-y-2 custom-scrollbar">
          {/* Live Section */}
          {(userLocation || otherLocation) && (
            <div className="mb-4 space-y-2">
              <p className="text-[10px] font-bold text-rose-400 uppercase tracking-widest px-2">Trực tuyến</p>
              {userLocation && (
                <motion.button
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={() => handleSelectLiveLocation(userLocation, "Bạn")}
                  className="w-full p-2 rounded-xl flex items-center gap-2 bg-blue-50/50 border border-blue-100/50 text-left hover:bg-blue-100/50 transition-all"
                >
                  <div className="w-10 h-10 rounded-lg bg-blue-500 flex items-center justify-center text-white shadow-sm">
                    <User size={18} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <h4 className="text-[10px] font-bold text-gray-800 truncate">Vị trí của bạn</h4>
                    <p className="text-[9px] text-blue-500 animate-pulse font-medium">Đang chia sẻ trực tiếp</p>
                  </div>
                  <Zap size={10} className="text-blue-500 fill-blue-500" />
                </motion.button>
              )}
              {otherLocation && (
                <motion.button
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={() => handleSelectLiveLocation(otherLocation, "Người ấy")}
                  className="w-full p-2 rounded-xl flex items-center gap-2 bg-rose-50/50 border border-rose-100/50 text-left hover:bg-rose-100/50 transition-all"
                >
                  <div className="w-10 h-10 rounded-lg overflow-hidden border-2 border-rose-200">
                    <img src={config.avatar_url || 'https://placehold.co/100x100?text=❤️'} className="w-full h-full object-cover" alt="" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <h4 className="text-[10px] font-bold text-gray-800 truncate">Vị trí của người ấy</h4>
                    <p className="text-[9px] text-rose-500 animate-pulse font-medium">Đang online ❤️</p>
                  </div>
                  <Zap size={10} className="text-rose-500 fill-rose-500" />
                </motion.button>
              )}
            </div>
          )}

          {/* Memories Section */}
          <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest px-2">Địa điểm cũ</p>
          {mapItems.map(item => (
            <motion.button
              key={item.id}
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              onClick={() => handleSelectFromList(item)}
              className={`w-full p-2 rounded-xl flex items-center gap-2 text-left transition-all ${selectedItem?.id === item.id ? 'bg-rose-500 text-white shadow-lg shadow-rose-200' : 'bg-white/60 hover:bg-white/80 text-gray-700 border border-white/50'}`}
            >
              <img 
                src={getOptimizedImageUrl(item.photo_url, 100)} 
                className="w-10 h-10 rounded-lg object-cover shadow-sm" 
                alt=""
              />
              <div className="flex-1 min-w-0">
                <h4 className={`text-[10px] font-bold truncate ${selectedItem?.id === item.id ? 'text-white' : 'text-gray-800'}`}>
                  {item.title}
                </h4>
                <p className={`text-[9px] truncate ${selectedItem?.id === item.id ? 'text-rose-100' : 'text-gray-500'}`}>
                  {(item.location as any)?.address_name || 'Không rõ địa chỉ'}
                </p>
              </div>
              <ChevronRight size={12} className={selectedItem?.id === item.id ? 'text-rose-100' : 'text-gray-300'} />
            </motion.button>
          ))}
        </div>
      </motion.div>

      {/* Map Content */}
      <div className="relative flex-1 min-h-[400px] h-full overflow-hidden">
        {/* HUD Controls */}
        <div className="absolute top-6 left-6 right-6 z-[1000] flex items-center justify-between pointer-events-none">
          <div className="flex gap-2 pointer-events-auto">
            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={() => setShowList(!showList)}
              className={`bg-white/70 backdrop-blur-md px-5 py-3 rounded-3xl border border-white/50 shadow-lg flex items-center gap-3 transition-colors ${showList ? 'bg-rose-500 text-white border-rose-400' : 'text-gray-800'}`}
            >
              <List size={20} />
              <span className="text-xs font-bold font-sans">Kỷ niệm</span>
            </motion.button>

            <div className="bg-white/70 backdrop-blur-md px-5 py-3 rounded-3xl border border-white/50 shadow-lg flex items-center gap-3">
              <div className="w-8 h-8 bg-rose-400/10 rounded-xl flex items-center justify-center text-rose-400 relative">
                <NavIcon size={16} />
                <span className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-green-500 rounded-full border-2 border-white animate-pulse"></span>
              </div>
              <div className="hidden sm:block">
                <h3 className="text-[10px] font-black text-gray-400 uppercase tracking-widest leading-none mb-1">Live Tracking</h3>
                <p className="text-xs font-bold text-gray-800 leading-none">
                  {otherLocation ? 'Cùng nhau ❤️' : 'Đang hoạt động'}
                </p>
              </div>
            </div>
          </div>

          <div className="flex gap-2 pointer-events-auto">
            <button 
              onClick={() => setIsFullscreen(!isFullscreen)}
              className="p-4 bg-white/70 backdrop-blur-md text-gray-800 rounded-3xl border border-white/50 shadow-lg hover:scale-110 active:scale-95 transition-all"
            >
              {isFullscreen ? <Minimize2 size={20} /> : <Maximize2 size={20} />}
            </button>
            {isFullscreen && (
              <button 
                onClick={() => setIsFullscreen(false)}
                className="p-4 bg-rose-400/10 backdrop-blur-md text-rose-500 rounded-3xl border border-rose-100 shadow-lg hover:scale-110 active:scale-95 transition-all"
              >
                <X size={20} />
              </button>
            )}
          </div>
        </div>

        <MapContainer
          center={[10.762622, 106.660172]}
          zoom={13}
          style={{ height: '100%', width: '100%', zIndex: 0 }}
          zoomControl={false}
        >
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />

          <MapController 
            userLocation={userLocation} 
            otherLocation={otherLocation} 
            mapItems={mapItems} 
          />

          <InvalidateSizeHandler trigger={showList || isFullscreen} />

          <FlyToController target={flyToCoords} />
          
          <MarkerClusterGroup
            chunkedLoading
            maxClusterRadius={50}
          >
            {mapItems.map((item) => (
              <Marker 
                key={item.id} 
                position={[item.location!.lat, item.location!.lng]}
                icon={createCustomIcon(getOptimizedImageUrl(item.photo_url, 100))}
                eventHandlers={{
                  click: () => {
                    setSelectedItem(item);
                    setFlyToCoords([item.location!.lat, item.location!.lng]);
                  }
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
            ))}
          </MarkerClusterGroup>

          {/* Live Markers */}
          {userLocation && (
            <Marker position={userLocation} icon={userIcon}>
              <Popup>Vị trí của bạn</Popup>
            </Marker>
          )}
          {otherLocation && (
            <Marker position={otherLocation} icon={otherIcon}>
              <Popup>Vị trí của người ấy ❤️</Popup>
            </Marker>
          )}

          <ZoomControl />
        </MapContainer>

        {/* Mobile Memory List Toggle */}
        {!showList && (
           <div className="absolute bottom-24 left-1/2 -translate-x-1/2 z-[1000] md:hidden">
              <button 
                onClick={() => setShowList(true)}
                className="bg-white/80 backdrop-blur-md px-6 py-3 rounded-full border border-white shadow-xl text-gray-800 text-xs font-bold flex items-center gap-2"
              >
                <List size={16} /> Xem danh sách
              </button>
           </div>
        )}
      </div>

      {/* Legend / Info */}
      {!isFullscreen && !showList && (
        <div className="absolute bottom-6 left-6 z-[1000] max-w-[200px]">
          <p className="text-[8px] font-bold text-gray-400 bg-white/50 backdrop-blur-sm px-3 py-1.5 rounded-full inline-block">
            Sử dụng OpenStreetMap & Leaflet
          </p>
        </div>
      )}
    </div>
  );
};

// Internal Plus/Minus icons for ZoomControl
const Plus = ({ size }: { size: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
    <line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
  </svg>
);
const Minus = ({ size }: { size: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
    <line x1="5" y1="12" x2="19" y2="12" />
  </svg>
);
