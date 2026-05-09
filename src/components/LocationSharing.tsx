import React from 'react';
import { supabase } from '../lib/supabase';
import { showNotification } from '../lib/notifications';

interface LocationSharingProps {
  userId: string;
}

export const LocationSharing: React.FC<LocationSharingProps> = ({ userId }) => {
  const lastUpdateRef = React.useRef<number>(0);
  const lastPosRef = React.useRef<[number, number] | null>(null);

  React.useEffect(() => {
    if (!userId || !supabase) return;

    const updateLocationInDB = async (lat: number, lng: number) => {
      try {
        const timestamp = new Date().toISOString();
        
        // Thử upsert dựa trên primary key hoặc unique constraint
        const { error } = await supabase.from('locations').upsert({
          user_id: userId,
          lat: lat,
          lng: lng,
          updated_at: timestamp
        }, { onConflict: 'user_id' });
        
        if (error) {
          console.error("Error updating location in DB:", error);
          // Fallback nếu table chưa có constraint
          if (error.code === '42P10') {
            const { data: existing } = await supabase
              .from('locations')
              .select('user_id')
              .eq('user_id', userId)
              .maybeSingle();

            if (existing) {
              await supabase
                .from('locations')
                .update({ lat, lng, updated_at: timestamp })
                .eq('user_id', userId);
            } else {
              await supabase
                .from('locations')
                .insert({ user_id: userId, lat, lng, updated_at: timestamp });
            }
          }
        }
      } catch (err) {
        console.error("Location upate critical failure:", err);
      }
    };

    const fetchLocationByIP = async () => {
      try {
        const response = await fetch('https://ipapi.co/json/');
        const data = await response.json();
        if (data.latitude && data.longitude) {
          updateLocationInDB(data.latitude, data.longitude);
        }
      } catch (err) {
        console.error("IP Location Fallback failed:", err);
      }
    };

    let watchId: number;

    if ("geolocation" in navigator) {
      watchId = navigator.geolocation.watchPosition(
        async (position) => {
          const { latitude, longitude, accuracy } = position.coords;
          const now = Date.now();

          // Throttling: Update DB every 15s or if moved > 3m or if first time
          const shouldUpdate = () => {
            if (!lastPosRef.current) return true;
            if (now - lastUpdateRef.current > 15000) return true;
            
            const dLat = Math.abs(latitude - lastPosRef.current[0]);
            const dLng = Math.abs(longitude - lastPosRef.current[1]);
            return dLat > 0.00003 || dLng > 0.00003; // ~3 meters
          };

          if (shouldUpdate()) {
            lastUpdateRef.current = now;
            lastPosRef.current = [latitude, longitude];
            updateLocationInDB(latitude, longitude);
          }
        },
        (error) => {
          console.warn("Geolocation watch error, attempting IP fallback:", error);
          fetchLocationByIP();
        },
        { enableHighAccuracy: true, maximumAge: 10000, timeout: 20000 }
      );
    } else {
      fetchLocationByIP();
    }

    // Handle visibility change to refresh location when coming back
    const handleVisibility = () => {
      if (document.visibilityState === 'visible' && "geolocation" in navigator) {
        navigator.geolocation.getCurrentPosition((pos) => {
          updateLocationInDB(pos.coords.latitude, pos.coords.longitude);
        }, undefined, { enableHighAccuracy: false });
      }
    };
    document.addEventListener('visibilitychange', handleVisibility);

    return () => {
      if (watchId) navigator.geolocation.clearWatch(watchId);
      document.removeEventListener('visibilitychange', handleVisibility);
    };
  }, [userId]);

  return null; // This component doesn't render anything
};
