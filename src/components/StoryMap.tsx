import React, { useState, useMemo } from 'react';
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet';
import L, { Icon, divIcon } from 'leaflet';
import MarkerClusterGroup from 'react-leaflet-cluster';
import { motion, AnimatePresence } from 'motion/react';
import { MapPin, Calendar, BookOpen, X, Maximize2, Minimize2, Navigation as NavIcon, ChevronRight, List, Zap, User, Plus, Minus } from 'lucide-react';
import { AppConfig, Database } from '../types';
import { getOptimizedImageUrl } from '../lib/imageUtils';
import { supabase } from '../lib/supabase';
import { usePresence } from '../lib/PresenceContext';
import { showNotification } from '../lib/notifications';

type Event = Database['public']['Tables']['events']['Row'];

// Regular marker icon
const defaultIcon = new Icon({
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
  iconSize: [25, 41],
  iconAnchor: [12, 41]
});

// Custom marker with image
const CustomMarker = ({ position, imageUrl, isOffline, label, animate = true }: { 
  position: [number, number], 
  imageUrl: string, 
  isOffline?: boolean, 
  label: string,
  animate?: boolean
}) => {
  const icon = useMemo(() => divIcon({
    className: 'custom-marker',
    html: `
      <div class="relative w-10 h-10 group ${isOffline ? 'opacity-60 grayscale-[0.5] blur-[0.5px]' : ''}">
        <div class="absolute -bottom-1 left-1/2 -translate-x-1/2 w-4 h-4 bg-white rotate-45 border-r border-b border-gray-100"></div>
        <div class="w-full h-full rounded-2xl border-4 border-white shadow-lg overflow-hidden group-hover:scale-110 transition-transform bg-rose-50">
          <img src="${imageUrl}" class="w-full h-full object-cover" />
        </div>
        ${!isOffline ? '<div class="absolute -top-1 -right-1 w-3 h-3 bg-green-500 rounded-full border-2 border-white shadow-sm animate-pulse"></div>' : ''}
      </div>
    `,
    iconSize: [40, 40],
    iconAnchor: [20, 40]
  }), [imageUrl, isOffline]);

  return (
    <Marker position={position} icon={icon}>
      <Popup>
        <div className="text-center font-bold text-gray-800">
          {label}
        </div>
      </Popup>
    </Marker>
  );
};

interface StoryMapProps {
  events: Event[];
  config: AppConfig;
  userId?: string;
  userProfile?: { id: string, avatar_url: string | null } | null;
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

export const StoryMap: React.FC<StoryMapProps> = ({ events, config, userId, userProfile }) => {
  const { isOtherOnline } = usePresence();
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [showList, setShowList] = useState(true);
  const [selectedItem, setSelectedItem] = useState<Event | null>(null);
  const [flyToCoords, setFlyToCoords] = useState<[number, number] | null>(null);
  const [userLocation, setUserLocation] = useState<[number, number] | null>(null);
  const [otherLocation, setOtherLocation] = useState<[number, number] | null>(null);
  const [userAddress, setUserAddress] = useState<string>('');
  const [otherAddress, setOtherAddress] = useState<string>('');
  const [otherLastUpdate, setOtherLastUpdate] = useState<string>('');
  const [otherProfile, setOtherProfile] = useState<{ avatar_url: string | null, name?: string } | null>(null);
  const lastUpdateRef = React.useRef<number>(0);
  const lastPosRef = React.useRef<[number, number] | null>(null);

  // Helper: Calculate distance in KM
  const distance = useMemo(() => {
    if (!userLocation || !otherLocation) return null;
    const [lat1, lon1] = userLocation;
    const [lat2, lon2] = otherLocation;
    const R = 6371; // Radius of the earth in km
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a = 
      Math.sin(dLat/2) * Math.sin(dLat/2) +
      Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * 
      Math.sin(dLon/2) * Math.sin(dLon/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    const d = R * c;
    return d.toFixed(2);
  }, [userLocation, otherLocation]);

  // Helper: Reverse Geocode
  const getAddress = async (lat: number, lng: number, setter: (addr: string) => void) => {
    try {
      const res = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&zoom=18&addressdetails=1`);
      const data = await res.json();
      if (data && data.address) {
        const addr = data.address.road || data.address.suburb || data.address.city || data.display_name.split(',')[0];
        setter(addr);
      }
    } catch (e) {
      console.error("Geocoding failed", e);
    }
  };

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
          if (newLoc && newLoc.user_id !== userId) {
            setOtherLocation([newLoc.lat, newLoc.lng]);
            setOtherLastUpdate(newLoc.updated_at);
            getAddress(newLoc.lat, newLoc.lng, setOtherAddress);
          }
        }
      )
      .subscribe();

    // 2. Fetch initial location of other person
    const fetchOtherLocation = async () => {
      const { data } = await supabase
        .from('locations')
        .select('*')
        .neq('user_id', userId)
        .order('updated_at', { ascending: false })
        .limit(1);
      
      if (data && data.length > 0) {
        setOtherLocation([data[0].lat, data[0].lng]);
        setOtherLastUpdate(data[0].updated_at);
        getAddress(data[0].lat, data[0].lng, setOtherAddress);

        // Fetch other user's profile avatar
        const { data: profile } = await supabase
          .from('profiles')
          .select('avatar_url')
          .eq('user_id', data[0].user_id)
          .maybeSingle();
        
        if (profile && profile.avatar_url) {
          setOtherProfile({ avatar_url: profile.avatar_url });
        }
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
               user_id: userId,
               lat: latitude,
               lng: longitude,
               updated_at: new Date().toISOString()
             });
             getAddress(latitude, longitude, setUserAddress);
          });
        }
      }
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);

    // 3. Watch current position
    let watchId: number;
    
    const updateLocationInDB = async (lat: number, lng: number) => {
      try {
        const { error } = await supabase.from('locations').upsert({
          user_id: userId,
          lat: lat,
          lng: lng,
          updated_at: new Date().toISOString()
        }, { onConflict: 'user_id' });
        
        if (error) {
          console.error("Error updating location in DB:", error);
          if (error.code === '42P01') {
            showNotification("Cơ sở dữ liệu Map chưa được khởi tạo. Vui lòng chạy SQL fix.", true);
          }
        }
      } catch (err) {
        console.error("Critical error updating location:", err);
      }
    };

    const fetchLocationByIP = async () => {
      try {
        const response = await fetch('https://ipapi.co/json/');
        const data = await response.json();
        if (data.latitude && data.longitude) {
          setUserLocation([data.latitude, data.longitude]);
          updateLocationInDB(data.latitude, data.longitude);
          getAddress(data.latitude, data.longitude, setUserAddress);
        }
      } catch (err) {
        console.error("IP Location Fallback failed:", err);
      }
    };

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
            updateLocationInDB(latitude, longitude);
            getAddress(latitude, longitude, setUserAddress);
          }
        },
        (error) => {
          console.warn("Geolocation error, attempting IP fallback:", error);
          fetchLocationByIP();
        },
        { enableHighAccuracy: true, maximumAge: 30000, timeout: 10000 }
      );
    } else {
      fetchLocationByIP();
    }

    return () => {
      if (watchId) navigator.geolocation.clearWatch(watchId);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      supabase.removeChannel(channel);
    };
  }, [userId]);

  const formatTime = (isoString: string) => {
    if (!isoString) return '';
    const date = new Date(isoString);
    const now = new Date();
    const diff = Math.floor((now.getTime() - date.getTime()) / 1000);
    if (diff < 60) return 'vừa xong';
    if (diff < 3600) return `${Math.floor(diff / 60)} phút trước`;
    return date.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' });
  };

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
    <div className={`relative transition-all duration-500 overflow-hidden flex flex-col md:flex-row ${isFullscreen ? 'fixed inset-0 z-[1500] h-[100dvh] w-screen bg-white' : 'h-[600px] md:h-[700px] rounded-[3rem] shadow-2xl border border-white/50 bg-white/40 backdrop-blur-xl'}`}>
      
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
        <div className="p-4 border-b border-white/20 flex items-center justify-between">
          <h3 className="text-xs font-black text-gray-800 uppercase tracking-tight flex items-center gap-2">
            <Zap size={14} className="text-rose-500 fill-rose-500 animate-pulse" />
            Live & Kỷ niệm
          </h3>
          <button onClick={() => setShowList(false)} className="md:hidden p-1 text-gray-400">
            <X size={16} />
          </button>
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
                  <div className="w-10 h-10 rounded-lg overflow-hidden border-2 border-blue-200">
                    <img src={userProfile?.avatar_url || 'https://placehold.co/100x100?text=Me'} className="w-full h-full object-cover" alt="" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <h4 className="text-[10px] font-bold text-gray-800 truncate">Vị trí của bạn</h4>
                    <p className="text-[9px] text-blue-500 animate-pulse font-medium truncate">
                      {userAddress || 'Đang chia sẻ trực tiếp...'}
                    </p>
                  </div>
                  <Zap size={10} className="text-blue-500 fill-blue-500" />
                </motion.button>
              )}
              {otherLocation && (
                <motion.button
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={() => handleSelectLiveLocation(otherLocation, "Người ấy")}
                  className={`w-full p-2 rounded-xl flex items-center gap-2 border text-left transition-all ${isOtherOnline ? 'bg-rose-50/50 border-rose-100/50' : 'bg-gray-50/50 border-gray-100/50 opacity-70'}`}
                >
                  <div className="w-10 h-10 rounded-lg overflow-hidden border-2 border-rose-200 relative">
                    <img src={otherProfile?.avatar_url || config.avatar_url || 'https://placehold.co/100x100?text=❤️'} className="w-full h-full object-cover" alt="" />
                    {isOtherOnline && <div className="absolute top-0 right-0 w-2.5 h-2.5 bg-green-500 border-2 border-white rounded-full"></div>}
                  </div>
                  <div className="flex-1 min-w-0">
                    <h4 className="text-[10px] font-bold text-gray-800 truncate">Vị trí của người ấy</h4>
                    <p className={`text-[9px] font-medium truncate ${isOtherOnline ? 'text-rose-500 animate-pulse' : 'text-gray-400'}`}>
                      {otherAddress || (isOtherOnline ? 'Đang online ❤️' : 'Đã offline 🌙')}
                      {otherLastUpdate && ` (${formatTime(otherLastUpdate)})`}
                    </p>
                  </div>
                  <Zap size={10} className={isOtherOnline ? 'text-rose-500 fill-rose-500' : 'text-gray-300'} />
                </motion.button>
              )}
              
              {distance && (
                <div className="px-2 py-1.5 bg-rose-50/30 rounded-lg flex items-center justify-center gap-2 border border-rose-100/30 mt-1">
                  <div className="w-1.5 h-1.5 rounded-full bg-rose-400 animate-ping"></div>
                  <p className="text-[9px] font-bold text-rose-400 uppercase tracking-widest leading-none">
                    Cách nhau {distance} km
                  </p>
                </div>
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
                  {distance ? `Cách nhau ${distance} km` : (otherLocation ? 'Cùng nhau ❤️' : 'Đang hoạt động')}
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
            {mapItems.map((item) => {
              const pos: [number, number] = [item.location!.lat, item.location!.lng];
              return (
                <Marker 
                  key={item.id} 
                  position={pos}
                  icon={L.divIcon({
                    className: 'memory-marker',
                    html: `
                      <div class="relative w-10 h-10 group">
                        <div class="absolute -bottom-1 left-1/2 -translate-x-1/2 w-4 h-4 bg-white rotate-45 border-r border-b border-gray-100"></div>
                        <div class="w-full h-full rounded-2xl border-4 border-white shadow-lg overflow-hidden group-hover:scale-110 transition-transform bg-rose-50">
                          <img src="${getOptimizedImageUrl(item.photo_url, 100)}" class="w-full h-full object-cover" />
                        </div>
                      </div>
                    `,
                    iconSize: [40, 40],
                    iconAnchor: [20, 40]
                  })}
                  eventHandlers={{
                    click: () => {
                      setSelectedItem(item);
                      setFlyToCoords(pos);
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
              );
            })}
          </MarkerClusterGroup>

          {/* Live Markers */}
          {userLocation && typeof userLocation[0] === 'number' && typeof userLocation[1] === 'number' && (
            <CustomMarker 
              position={userLocation} 
              imageUrl={userProfile?.avatar_url || 'https://placehold.co/100x100?text=Me'} 
              isOffline={false}
              label={`Bạn ${userAddress ? `(${userAddress})` : ''}`}
            />
          )}
          {otherLocation && typeof otherLocation[0] === 'number' && typeof otherLocation[1] === 'number' && (
            <CustomMarker 
              position={otherLocation} 
              imageUrl={otherProfile?.avatar_url || config.avatar_url || 'https://placehold.co/100x100?text=❤️'} 
              isOffline={!isOtherOnline}
              label={isOtherOnline ? `Người ấy ❤️ ${otherAddress ? `(${otherAddress})` : ''}` : `Vị trí cuối 🌙 ${otherAddress ? `(${otherAddress})` : ''}`}
            />
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
