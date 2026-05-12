import React, { useState, useMemo, useEffect } from 'react';
import { MapContainer, TileLayer, Marker, Popup, useMap, Tooltip, Circle, Polyline } from 'react-leaflet';
import L, { Icon, divIcon } from 'leaflet';
import MarkerClusterGroup from 'react-leaflet-cluster';
import { motion, AnimatePresence } from 'motion/react';
import { MapPin, Calendar, BookOpen, X, Maximize2, Minimize2, Navigation as NavIcon, ChevronRight, List, Zap, User, Plus, Minus } from 'lucide-react';
import { AppConfig, Database } from '../types';
import { getOptimizedImageUrl } from '../lib/imageUtils';
import { supabase } from '../lib/supabase';
import { usePresence } from '../lib/PresenceContext';
import { showNotification } from '../lib/notifications';
import { reverseGeocode } from '../lib/geocoding';

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
    targetPosRef.current = position;
    
    const animate = () => {
      const [curLat, curLng] = currentPosRef.current;
      const [tarLat, tarLng] = targetPosRef.current;
      
      const dfLat = tarLat - curLat;
      const dfLng = tarLng - curLng;
      const factor = 0.04; // Animation speed
      
      if (Math.abs(dfLat) < 0.0000001 && Math.abs(dfLng) < 0.0000001) {
        if (markerRef.current) markerRef.current.setLatLng(targetPosRef.current);
        currentPosRef.current = targetPosRef.current;
        requestRef.current = undefined;
        return;
      }
      
      const nextPos: [number, number] = [
        curLat + dfLat * factor,
        curLng + dfLng * factor
      ];
      
      if (markerRef.current) {
        markerRef.current.setLatLng(nextPos);
      }
      currentPosRef.current = nextPos;
      requestRef.current = requestAnimationFrame(animate);
    };

    if (!requestRef.current) {
      requestRef.current = requestAnimationFrame(animate);
    }
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
const CustomMarker = React.memo(({ position, imageUrl, isOffline, label, color = 'rose' }: { 
  position: [number, number], 
  imageUrl: string, 
  isOffline?: boolean, 
  label: string,
  color?: 'rose' | 'blue'
}) => {
  const borderColor = color === 'rose' ? (isOffline ? 'border-gray-200 grayscale' : 'border-rose-400') : (isOffline ? 'border-gray-200 grayscale' : 'border-blue-400');
  const arrowColor = color === 'rose' ? (isOffline ? 'bg-gray-200' : 'bg-rose-400') : (isOffline ? 'bg-gray-200' : 'bg-blue-400');
  const pingColor = color === 'rose' ? 'bg-rose-400/20' : 'bg-blue-400/20';
  const pulseBorder = color === 'rose' ? 'border-rose-400/30' : 'border-blue-400/30';
  const labelColor = color === 'rose' ? 'text-rose-500 border-rose-100' : 'text-blue-500 border-blue-100';

  const icon = useMemo(() => divIcon({
    className: 'custom-div-icon',
    html: `
      <div class="relative group animate-marker-breath" style="will-change: transform;">
        <svg width="48" height="60" viewBox="0 0 48 60" class="relative z-10 drop-shadow-2xl">
          <defs>
            <clipPath id="avatarClip">
              <rect x="4" y="4" width="40" height="40" rx="12" />
            </clipPath>
          </defs>
          <!-- Outer Border / Shadow -->
          <rect x="2" y="2" width="44" height="44" rx="14" fill="white" />
          <rect x="2" y="2" width="44" height="44" rx="14" fill="none" stroke="${color === 'rose' ? '#fb7185' : '#60a5fa'}" stroke-width="4" class="${isOffline ? 'grayscale' : ''}" />
          
          <!-- Pin Tip -->
          <path d="M24 60 L18 46 L30 46 Z" fill="${color === 'rose' ? '#fb7185' : '#60a5fa'}" class="${isOffline ? 'grayscale' : ''}" />
          
          <!-- Avatar -->
          <image 
            href="${imageUrl}" 
            x="4" y="4" width="40" height="40" 
            clip-path="url(#avatarClip)"
            preserveAspectRatio="xMidYMid slice"
            class="${isOffline ? 'grayscale' : ''}"
          />
          
          ${!isOffline ? `
            <circle cx="40" cy="8" r="5" fill="white" />
            <circle cx="40" cy="8" r="3" fill="#22c55e" class="animate-pulse" />
          ` : ''}
        </svg>

        ${!isOffline ? `
          <div class="absolute top-0 left-0 w-12 h-12 rounded-2xl ${pingColor} animate-ping -z-10"></div>
          <div class="absolute -inset-2 rounded-2xl border-2 ${pulseBorder} animate-marker-pulse -z-10"></div>
        ` : ''}
      </div>
    `,
    iconSize: [48, 60],
    iconAnchor: [24, 60],
  }), [imageUrl, isOffline, color]);

  return (
    <SmoothMarker position={position} icon={icon}>
      <Popup className="custom-popup">
        <div className="text-center p-1">
          <p className="text-[10px] font-black uppercase tracking-widest text-gray-400 mb-1">{isOffline ? 'Offline' : 'Online'}</p>
          <p className="text-xs font-bold text-gray-800">{label}</p>
        </div>
      </Popup>
      <Tooltip direction="top" offset={[0, -20]} opacity={1} permanent>
        <span className={`text-[10px] font-bold bg-white/90 backdrop-blur-sm px-2 py-0.5 rounded-full shadow-sm border ${labelColor}`}>
          {label}
        </span>
      </Tooltip>
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
  userProfile?: { id: string, avatar_url: string | null, full_name?: string } | null;
}

interface TrackedUser {
  user_id: string;
  lat: number;
  lng: number;
  updated_at: string;
  avatar_url: string | null;
  name: string;
  address: string;
  isOnline: boolean;
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
  const lastKeyRef = React.useRef(0);

  const points = useMemo(() => {
    const pts: [number, number][] = [];
    if (userLoc && isValidCoords(userLoc)) pts.push(userLoc);
    if (otherLoc && isValidCoords(otherLoc)) pts.push(otherLoc);
    return pts;
  }, [userLoc, otherLoc]);

  React.useEffect(() => {
    if (points.length === 0) return;

    // Trigger on initial load (points exist) or when refocus button clicked
    if (refocusKey !== lastKeyRef.current || (points.length > 0 && lastKeyRef.current === 0)) {
      lastKeyRef.current = refocusKey;
      
      if (points.length === 1) {
        map.flyTo(points[0], 16, { 
          duration: 2,
          easeLinearity: 0.1
        });
      } else {
        const bounds = L.latLngBounds(points);
        map.fitBounds(bounds, { 
          padding: [70, 70], 
          maxZoom: 16, 
          duration: 2,
          easeLinearity: 0.1
        });
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
    setTimeout(() => {
      map.invalidateSize();
    }, 500); // Wait for transition animation to finish
  }, [trigger, map]);
  return null;
};

// Removed old MapController

export const StoryMap: React.FC<StoryMapProps> = ({ events, config, userId, userProfile }) => {
  const { isOtherOnline: isOtherPresenceOnline } = usePresence();
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [showList, setShowList] = useState(true);
  const [selectedItem, setSelectedItem] = useState<Event | null>(null);
  const [flyToCoords, setFlyToCoords] = useState<[number, number] | null>(null);
  const [trackedUsers, setTrackedUsers] = useState<Record<string, TrackedUser>>({});
  const [refocusKey, setRefocusKey] = useState(0);
  const lastFetchedPosRef = React.useRef<Record<string, string>>({});

  const sortedUsers = useMemo(() => {
    return Object.values(trackedUsers).sort((a, b) => {
      if (a.user_id === userId) return -1;
      if (b.user_id === userId) return 1;
      return 0;
    });
  }, [trackedUsers, userId]);

  // Helper: Geocode with wrapper and rate limit protection
  const getAddress = async (lat: number, lng: number, userId: string) => {
    if (!lat || !lng) return;
    const key = `${lat.toFixed(4)},${lng.toFixed(4)}`;
    if (lastFetchedPosRef.current[userId] === key) return;
    
    try {
      lastFetchedPosRef.current[userId] = key;
      const addr = await reverseGeocode(lat, lng);
      setTrackedUsers(prev => ({
        ...prev,
        [userId]: { ...prev[userId], address: addr }
      }));
    } catch (e) {
      setTrackedUsers(prev => ({
        ...prev,
        [userId]: { ...prev[userId], address: `${lat.toFixed(4)}, ${lng.toFixed(4)}` }
      }));
    }
  };

  useEffect(() => {
    Object.values(trackedUsers).forEach(user => {
      getAddress(user.lat, user.lng, user.user_id);
    });
  }, [JSON.stringify(Object.values(trackedUsers).map(u => `${u.lat},${u.lng}`))]);

  const formatTime = (isoString: string) => {
    if (!isoString) return '';
    const date = new Date(isoString);
    const now = new Date();
    const diff = Math.floor((now.getTime() - date.getTime()) / 1000);
    if (diff < 60) return 'vừa xong';
    if (diff < 3600) return `${Math.floor(diff / 60)} phút trước`;
    return date.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' });
  };

  // Real-time Location Sharing
  React.useEffect(() => {
    if (!userId || !supabase) return;

    let profilesMap: Record<string, any> = {};

    const fetchAllData = async () => {
      try {
        // 1. Fetch Profiles
        const { data: profiles } = await supabase
          .from('profiles')
          .select('user_id, avatar_url, full_name' as any);
        
        if (profiles) {
          profiles.forEach(p => {
            profilesMap[p.user_id] = p;
          });
        }

        // 2. Fetch Locations
        const { data: locations } = await supabase
          .from('locations')
          .select('*');
        
        if (locations) {
          const newTrackedUsers: Record<string, TrackedUser> = {};
          locations.forEach(loc => {
            const profile = profilesMap[loc.user_id];
            const isOnline = (Date.now() - new Date(loc.updated_at).getTime()) < 300000; // 5 mins
            
            let name = 'Người dùng';
            if (loc.user_id === userId) {
              name = 'Bạn';
            } else if (profile?.full_name) {
              name = profile.full_name;
            } else {
              // Fallback based on config if there are only 2 users
              name = config.name_male === 'Anh' ? 'Người ấy' : 'Người ấy';
            }

            newTrackedUsers[loc.user_id] = {
              user_id: loc.user_id,
              lat: Number(loc.lat),
              lng: Number(loc.lng),
              updated_at: loc.updated_at,
              avatar_url: profile?.avatar_url || null,
              name: name,
              address: '',
              isOnline: isOnline
            };
          });
          setTrackedUsers(newTrackedUsers);
        }
      } catch (err) {
        console.error("Fetch initial data failed:", err);
      }
    };

    fetchAllData();

    // Setup Realtime Listener for locations
    const channel = supabase
      .channel('location-updates-all')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'locations' },
        async (payload: any) => {
          const loc = payload.new;
          if (!loc) return;

          const uid = loc.user_id;
          const coords: [number, number] = [Number(loc.lat), Number(loc.lng)];
          if (!isValidCoords(coords)) return;

          // If tracking a new user, fetch their profile first
          if (!profilesMap[uid]) {
            const { data: profile } = await supabase
              .from('profiles')
              .select('user_id, avatar_url, full_name' as any)
              .eq('user_id', uid)
              .maybeSingle();
            if (profile) profilesMap[uid] = profile;
          }

          setTrackedUsers(prev => {
            const profile = profilesMap[uid];
            const name = uid === userId ? 'Bạn' : (profile?.full_name || 'Người ấy');
            return {
              ...prev,
              [uid]: {
                user_id: uid,
                lat: coords[0],
                lng: coords[1],
                updated_at: loc.updated_at,
                avatar_url: profile?.avatar_url || prev[uid]?.avatar_url || null,
                name: name,
                address: prev[uid]?.address || '',
                isOnline: true
              }
            };
          });
        }
      )
      .subscribe();

    const interval = setInterval(fetchAllData, 60000); // 1 min refresh fallback

    return () => {
      supabase.removeChannel(channel);
      clearInterval(interval);
    };
  }, [userId]);

  // Derived properties for UI
  const userLocation = trackedUsers[userId!] ? [trackedUsers[userId!].lat, trackedUsers[userId!].lng] as [number, number] : null;
  const otherUsers = sortedUsers.filter(u => u.user_id !== userId);
  const mainOther = otherUsers[0] || null;
  const otherLocation = mainOther ? [mainOther.lat, mainOther.lng] as [number, number] : null;
  const isOtherOnline = mainOther?.isOnline || false;
  const otherAddress = mainOther?.address || '';
  const otherLastUpdate = mainOther?.updated_at || '';
  const userAddress = trackedUsers[userId!]?.address || '';
  const otherProfile = mainOther ? { avatar_url: mainOther.avatar_url, id: mainOther.user_id } : null;

  const distance = useMemo(() => {
    if (!userLocation || !otherLocation) return null;
    const [lat1, lon1] = userLocation;
    const [lat2, lon2] = otherLocation;
    const R = 6371; // km
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a = 
      Math.sin(dLat/2) * Math.sin(dLat/2) +
      Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * 
      Math.sin(dLon/2) * Math.sin(dLon/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    const d = R * c;
    return d < 1 ? `${(d * 1000).toFixed(0)}m` : `${d.toFixed(2)}km`;
  }, [userLocation, otherLocation]);

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
        <div className="flex-1 overflow-y-auto p-2 space-y-4 custom-scrollbar">
          {/* Live Section */}
          <div className="space-y-2">
            <p className="text-[10px] font-black text-rose-500 uppercase tracking-widest px-2 flex items-center gap-2">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-rose-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-rose-500"></span>
              </span>
              Trực tiếp
            </p>
            
            {sortedUsers.map(user => (
              <motion.button
                key={user.user_id}
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                onClick={() => handleSelectLiveLocation([user.lat, user.lng], user.name)}
                className={`w-full p-3 rounded-2xl border transition-all flex items-center gap-3 ${user.isOnline ? 'bg-rose-50/50 border-rose-100' : 'bg-white/60 border-white/50'}`}
              >
                <div className={`w-10 h-10 rounded-xl overflow-hidden shadow-sm border-2 ${user.isOnline ? 'border-rose-400' : 'border-white'} bg-gray-50`}>
                  <img src={user.avatar_url || 'https://placehold.co/100x100?text=' + user.name.charAt(0)} className={`w-full h-full object-cover ${user.isOnline ? '' : 'grayscale'}`} alt={user.name} />
                </div>
                <div className="flex-1 min-w-0">
                  <h4 className="text-[11px] font-bold text-gray-800 flex items-center gap-1">
                    {user.name}
                    {user.isOnline && <span className="w-1.5 h-1.5 bg-green-500 rounded-full"></span>}
                  </h4>
                  <p className="text-[9px] text-gray-500 truncate">{user.address || 'Đang xác định vị trí...'}</p>
                  {user.user_id !== userId && distance && user.isOnline && (
                    <p className="text-[10px] font-bold text-rose-500 flex items-center gap-1 mt-0.5">
                      <NavIcon size={10} className="rotate-45" /> Cách bạn {distance}
                    </p>
                  )}
                  {user.updated_at && <p className="text-[8px] text-gray-400 mt-0.5">{formatTime(user.updated_at)}</p>}
                </div>
              </motion.button>
            ))}
          </div>

          {/* Memories Section */}
          <div className="space-y-2">
            <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest px-2">Kỷ niệm cũ</p>
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
              className="bg-white/70 backdrop-blur-md px-5 py-3 rounded-3xl border border-white/50 shadow-lg flex items-center gap-3 text-gray-800 hover:text-rose-500 transition-colors"
              title="Tìm người ấy"
            >
              <Zap size={20} className="text-rose-500" />
              <span className="text-xs font-bold font-sans">Tìm người ấy</span>
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
              position={[user.lat, user.lng]}
              imageUrl={user.avatar_url || 'https://placehold.co/100x100?text=' + user.name.charAt(0)}
              isOffline={!user.isOnline}
              label={user.name}
              color={user.user_id === userId ? 'rose' : 'blue'}
            />
          ))}

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
