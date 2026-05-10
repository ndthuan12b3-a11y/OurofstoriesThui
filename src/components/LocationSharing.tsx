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
      if (!lat || !lng || isNaN(lat) || isNaN(lng)) return;
      
      try {
        const timestamp = new Date().toISOString();
        
        // Cache locally for the UI to use instantly
        localStorage.setItem(`last_loc_${userId}`, JSON.stringify([lat, lng]));

        // Thử upsert dựa trên primary key hoặc unique constraint
        const locationData = {
          id: userId,
          user_id: userId,
          lat: lat,
          lng: lng,
          updated_at: new Date()
        };

        const { error } = await supabase
          .from('locations')
          .upsert(locationData, { onConflict: 'id' });
        
        if (error) {
          console.error("Error updating location in DB:", error);
          
          // Secondary fallback if upsert fails on conflict constraint
          if (error.code === '42P10') {
            const { data: existing } = await supabase
              .from('locations')
              .select('user_id')
              .eq('user_id', userId)
              .maybeSingle();

            if (existing) {
              await supabase
                .from('locations')
                .update({ lat, lng, updated_at: new Date() })
                .eq('user_id', userId);
            } else {
              await supabase
                .from('locations')
                .insert(locationData);
            }
          }
        }
      } catch (err) {
        console.error("Location upate critical failure:", err);
      }
    };

    const fetchLocationByIP = async () => {
      // Helper to try a service
      const tryService = async (url: string) => {
        try {
          const res = await fetch(url);
          if (!res.ok) return null;
          const data = await res.json();
          // Extract lat/lng based on common formats
          const lat = data.latitude || data.lat;
          const lng = data.longitude || data.lon;
          if (lat && lng) return { lat: Number(lat), lng: Number(lng) };
        } catch (e) {
          return null;
        }
        return null;
      };

      // Try multiple services in order
      const services = [
        'https://ipapi.co/json/',
        'https://freeipapi.com/api/json'
      ];

      for (const url of services) {
        const result = await tryService(url);
        if (result) {
          updateLocationInDB(result.lat, result.lng);
          return;
        }
      }
      
      console.warn("All IP Location Fallbacks failed to fetch coordinates.");
    };

    let watchId: number;

    if ("geolocation" in navigator) {
      watchId = navigator.geolocation.watchPosition(
        async (position) => {
          const { latitude, longitude, accuracy } = position.coords;
          const now = Date.now();

          // Throttling: Update DB every 10s or if moved > 2m or if first time
          const shouldUpdate = () => {
            if (!lastPosRef.current) return true;
            if (now - lastUpdateRef.current > 10000) return true;
            
            const dLat = Math.abs(latitude - lastPosRef.current[0]);
            const dLng = Math.abs(longitude - lastPosRef.current[1]);
            return dLat > 0.00002 || dLng > 0.00002; // ~2 meters
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
        { enableHighAccuracy: true, maximumAge: 5000, timeout: 15000 }
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
