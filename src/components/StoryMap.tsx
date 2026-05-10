import React, { useState, useMemo } from 'react';
import { MapContainer, TileLayer, Marker, Popup, useMap, Tooltip } from 'react-leaflet';
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
const CustomMarker = ({ position, imageUrl, isOffline, label }: { 
  position: [number, number], 
  imageUrl: string, 
  isOffline?: boolean, 
  label: string
}) => {
  const icon = useMemo(() => divIcon({
    className: 'custom-div-icon',
    html: `
      <div class="relative group">
        <div class="w-12 h-12 rounded-2xl overflow-hidden border-4 ${isOffline ? 'border-gray-200 grayscale' : 'border-rose-400'} shadow-2xl relative z-10 bg-white">
          <img src="${imageUrl}" class="w-full h-full object-cover" />
          ${!isOffline ? '<div class="absolute top-0 right-0 w-3 h-3 bg-green-500 border-2 border-white rounded-full animate-pulse"></div>' : ''}
        </div>
        <div class="absolute -bottom-1 left-1/2 -translate-x-1/2 w-4 h-4 ${isOffline ? 'bg-gray-200' : 'bg-rose-400'} rotate-45 shadow-lg"></div>
        ${!isOffline ? `
          <div class="absolute inset-x-0 inset-y-0 rounded-2xl bg-rose-400/20 animate-ping"></div>
          <div class="absolute -inset-2 rounded-2xl border-2 border-rose-400/30 animate-pulse"></div>
        ` : ''}
      </div>
    `,
    iconSize: [48, 48],
    iconAnchor: [24, 48],
  }), [imageUrl, isOffline]);

  return (
    <Marker position={position} icon={icon}>
      <Popup className="custom-popup">
        <div className="text-center p-1">
          <p className="text-[10px] font-black uppercase tracking-widest text-gray-400 mb-1">{isOffline ? 'Offline' : 'Online'}</p>
          <p className="text-xs font-bold text-gray-800">{label}</p>
        </div>
      </Popup>
      <Tooltip direction="top" offset={[0, -20]} opacity={1} permanent>
        <span className="text-[10px] font-bold text-rose-500 bg-white/90 backdrop-blur-sm px-2 py-0.5 rounded-full shadow-sm border border-rose-100">
          {label}
        </span>
      </Tooltip>
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

// Helper to validate coordinates
const isValidCoords = (coords: any): coords is [number, number] => {
  if (!Array.isArray(coords) || coords.length !== 2) return false;
  const lat = Number(coords[0]);
  const lng = Number(coords[1]);
  return typeof lat === 'number' && !isNaN(lat) && isFinite(lat) &&
         typeof lng === 'number' && !isNaN(lng) && isFinite(lng);
};

// Component to handle external "FlyTo" commands
const FlyToController = ({ target }: { target: [number, number] | null }) => {
  const map = useMap();
  React.useEffect(() => {
    if (target && isValidCoords(target)) {
      try {
        map.flyTo(target, 17, {
          duration: 2,
          easeLinearity: 0.25
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
  mapItems,
  refocusKey
}: { 
  userLocation: [number, number] | null, 
  otherLocation: [number, number] | null,
  mapItems: any[],
  refocusKey: number
}) => {
  const map = useMap();
  const hasFittedLiveRef = React.useRef(false);
  const hasFittedItemsRef = React.useRef(false);
  
  React.useEffect(() => {
    // 1. Manual Refocus (Button or specific interaction)
    const isManual = refocusKey > 0 && refocusKey !== (map as any)._lastRefocusKey;
    
    // 2. Initial Live Locations (One-time auto fit for live)
    const hasLive = (userLocation && isValidCoords(userLocation)) || (otherLocation && isValidCoords(otherLocation));
    const shouldFitLive = hasLive && !hasFittedLiveRef.current;

    // 3. Initial Map Items (Fallback)
    const shouldFitItems = mapItems.length > 0 && !hasFittedItemsRef.current && !hasLive;

    // 4. Auto-follow: If both are active and moving, keep them in view
    // Only auto-follow if the user hasn't manually panned away recently
    const lastUserInteraction = (map as any)._lastInteractionTime || 0;
    const isInteracting = Date.now() - lastUserInteraction < 5000;
    const shouldAutoFollow = hasLive && !isInteracting && hasFittedLiveRef.current;

    if (!isManual && !shouldFitLive && !shouldFitItems && !shouldAutoFollow) return;

    const points: [number, number][] = [];
    if (userLocation && isValidCoords(userLocation)) points.push(userLocation);
    if (otherLocation && isValidCoords(otherLocation)) points.push(otherLocation);
    
    if (points.length === 0 && mapItems.length > 0) {
      mapItems.forEach(item => {
        if (item.location?.lat && item.location?.lng) {
          const p: [number, number] = [Number(item.location.lat), Number(item.location.lng)];
          if (isValidCoords(p)) {
            points.push(p);
          }
        }
      });
    }

    if (points.length > 0) {
      try {
        const bounds = L.latLngBounds(points);
        if (bounds && bounds.isValid()) {
          const padding: [number, number] = window.innerWidth < 768 ? [60, 60] : [120, 120];
          
          // Use flyToBounds if it's an auto-follow update for smoothness
          if (shouldAutoFollow) {
            map.flyToBounds(bounds, { padding, duration: 1.5, easeLinearity: 0.25, maxZoom: 15 });
          } else {
            map.fitBounds(bounds, { padding, maxZoom: 15 });
          }
          
          if (hasLive) hasFittedLiveRef.current = true;
          if (mapItems.length > 0) hasFittedItemsRef.current = true;
          if (isManual) (map as any)._lastRefocusKey = refocusKey;
        }
      } catch (e) {
        console.error("Error fitting bounds:", e);
      }
    }
  }, [userLocation, otherLocation, map, mapItems, refocusKey]);

  // Track map interactions to pause auto-follow
  React.useEffect(() => {
    const setInteraction = () => {
      (map as any)._lastInteractionTime = Date.now();
    };
    map.on('movestart', setInteraction);
    map.on('zoomstart', setInteraction);
    return () => {
      map.off('movestart', setInteraction);
      map.off('zoomstart', setInteraction);
    };
  }, [map]);

  return null;
};

export const StoryMap: React.FC<StoryMapProps> = ({ events, config, userId, userProfile }) => {
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
  const [refocusKey, setRefocusKey] = useState(0);
  const lastUpdateRef = React.useRef<number>(0);
  const lastPosRef = React.useRef<[number, number] | null>(null);

  const isOtherOnline = useMemo(() => {
    if (!otherLastUpdate) return false;
    const lastUpdate = new Date(otherLastUpdate).getTime();
    const now = Date.now();
    // Consider online if update within 2 minutes
    return (now - lastUpdate) < 120000;
  }, [otherLastUpdate]);

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

  // Helper: Reverse Geocode with simplified logic and rate limit protection
  const fetchingRef = React.useRef<{ [key: string]: boolean }>({});
  const getAddress = async (lat: number, lng: number, setter: (addr: string) => void) => {
    if (!lat || !lng) return;
    const key = `${lat.toFixed(4)},${lng.toFixed(4)}`;
    if (fetchingRef.current[key]) return;
    
    try {
      fetchingRef.current[key] = true;
      // Small delay to avoid hitting OpenStreetMap too fast
      await new Promise(r => setTimeout(r, 1500));
      const res = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&zoom=18&addressdetails=1`);
      if (!res.ok) {
        if (res.status === 429) {
          console.warn("Nominatim rate limited");
          return;
        }
        throw new Error("API error");
      }
      const data = await res.json();
      if (data && data.address) {
        const addr = data.address.road || data.address.suburb || data.address.city || data.address.state || data.display_name.split(',')[0];
        setter(addr);
      }
    } catch (e) {
      console.error("Geocoding failed", e);
    } finally {
      fetchingRef.current[key] = false;
    }
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

    // 1. Setup Realtime Listener for locations
    const channel = supabase
      .channel('location-updates')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'locations' },
        (payload: any) => {
          const newLoc = payload.new;
          if (!newLoc) return;
          
          // Cast values to Number explicitly
          const coords: [number, number] = [Number(newLoc.lat), Number(newLoc.lng)];
          if (!isValidCoords(coords)) return;
          
          if (newLoc.user_id === userId) {
            setUserLocation(coords);
            getAddress(coords[0], coords[1], setUserAddress);
            // Cache locally for instant load next time
            localStorage.setItem(`last_loc_${userId}`, JSON.stringify(coords));
          } else {
            setOtherLocation(coords);
            setOtherLastUpdate(newLoc.updated_at);
            getAddress(coords[0], coords[1], setOtherAddress);
            localStorage.setItem(`last_loc_other`, JSON.stringify({ coords, updated_at: newLoc.updated_at, user_id: newLoc.user_id }));
          }
        }
      )
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') {
          console.log("Joined location channel");
        }
      });

    // 2. Fetch initial locations
    const fetchLocations = async () => {
      try {
        // Try local cache first for snappier UI
        const cachedMe = localStorage.getItem(`last_loc_${userId}`);
        if (cachedMe) {
          try {
            const parsed = JSON.parse(cachedMe);
            if (isValidCoords(parsed)) {
              setUserLocation(parsed);
            }
          } catch (e) {
            console.warn("Me cache invalid", e);
          }
        }

        const cachedOther = localStorage.getItem(`last_loc_other`);
        if (cachedOther) {
          try {
            const parsed = JSON.parse(cachedOther);
            if (parsed.coords && isValidCoords(parsed.coords)) {
              setOtherLocation(parsed.coords);
              setOtherLastUpdate(parsed.updated_at);
            }
          } catch (e) {
            console.warn("Other cache invalid", e);
          }
        }

        // Fetch MY location from DB
        const { data: myData } = await supabase
          .from('locations')
          .select('*')
          .eq('user_id', userId)
          .maybeSingle();
        
        if (myData) {
          const coords: [number, number] = [Number(myData.lat), Number(myData.lng)];
          setUserLocation(coords);
          getAddress(coords[0], coords[1], setUserAddress);
          localStorage.setItem(`last_loc_${userId}`, JSON.stringify(coords));
        }

        // Fetch OTHER person location from DB
        const { data: others, error } = await supabase
          .from('locations')
          .select('*')
          .neq('user_id', userId)
          .order('updated_at', { ascending: false })
          .limit(1);
        
        if (others && others.length > 0) {
          const coords: [number, number] = [Number(others[0].lat), Number(others[0].lng)];
          setOtherLocation(coords);
          setOtherLastUpdate(others[0].updated_at || '');
          getAddress(coords[0], coords[1], setOtherAddress);
          localStorage.setItem(`last_loc_other`, JSON.stringify({ coords, updated_at: others[0].updated_at, user_id: others[0].user_id }));

          // Fetch profile
          const { data: profile } = await supabase
            .from('profiles')
            .select('avatar_url')
            .eq('user_id', others[0].user_id)
            .maybeSingle();
          
          if (profile) {
            setOtherProfile({ avatar_url: profile.avatar_url });
          }
        }
      } catch (err) {
        console.error("Fetch locations failed:", err);
      }
    };
    fetchLocations();

    // 2b. Handle Visibility Change
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        fetchLocations();
      }
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
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
    if (!item.location) return;
    const lat = Number(item.location.lat);
    const lng = Number(item.location.lng);
    if (!isNaN(lat) && !isNaN(lng)) {
      setFlyToCoords([lat, lng]);
      setSelectedItem(item);
      if (window.innerWidth < 768) setShowList(false);
    }
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
            Kỷ niệm
          </h3>
          <button onClick={() => setShowList(false)} className="md:hidden p-1 text-gray-400">
            <X size={16} />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto p-2 space-y-2 custom-scrollbar">
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
              onClick={() => setRefocusKey(prev => prev + 1)}
              className="bg-white/70 backdrop-blur-md px-5 py-3 rounded-3xl border border-white/50 shadow-lg flex items-center gap-3 text-gray-800 hover:text-rose-500 transition-colors"
              title="Tìm 2 đứa"
            >
              <Zap size={20} className="text-rose-500" />
              <span className="text-xs font-bold font-sans">Tìm 2 đứa</span>
            </motion.button>

            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={() => setShowList(!showList)}
              className={`bg-white/70 backdrop-blur-md px-5 py-3 rounded-3xl border border-white/50 shadow-lg flex items-center gap-3 transition-colors ${showList ? 'bg-rose-500 text-white border-rose-400' : 'text-gray-800'}`}
            >
              <List size={20} />
              <span className="text-xs font-bold font-sans">Kỷ niệm</span>
            </motion.button>
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
            refocusKey={refocusKey}
          />

          <InvalidateSizeHandler trigger={showList || isFullscreen} />

          <FlyToController target={flyToCoords} />
          
          <MarkerClusterGroup
            chunkedLoading
            maxClusterRadius={50}
          >
            {mapItems.map((item) => {
              const pos: [number, number] = [Number(item.location!.lat), Number(item.location!.lng)];
              if (!isValidCoords(pos)) return null;
              
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
          {userLocation && isValidCoords(userLocation) && (
            <CustomMarker 
              position={userLocation} 
              imageUrl={userProfile?.avatar_url || 'https://placehold.co/100x100?text=Me'} 
              isOffline={false}
              label={`Bạn ❤️`}
            />
          )}
          {otherLocation && isValidCoords(otherLocation) && (
            <CustomMarker 
              position={otherLocation} 
              imageUrl={otherProfile?.avatar_url || config.avatar_url || 'https://placehold.co/100x100?text=❤️'} 
              isOffline={!isOtherOnline}
              label={isOtherOnline ? `Người ấy đang online ❤️` : `Vị trí cuối của em 🌙`}
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
