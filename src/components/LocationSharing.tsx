import React from 'react';
import { supabase } from '../lib/supabase';
import { showNotification } from '../lib/notifications';
import { usePresence } from '../lib/PresenceContext';

interface LocationSharingProps {
  userId: string;
}

export const LocationSharing: React.FC<LocationSharingProps> = ({ userId }) => {
  const lastUpdateRef = React.useRef<number>(0);
  const lastPosRef = React.useRef<[number, number] | null>(null);
  const { updateLocation: updatePresenceLocation } = usePresence();

  React.useEffect(() => {
    if (!userId || !supabase) return;

    const updateLocationInDB = async (lat: number, lng: number) => {
      if (!lat || !lng || isNaN(lat) || isNaN(lng)) return;
      
      // Real-time presence update (high frequency, no DB cost)
      updatePresenceLocation(lat, lng);

      // Kiểm tra kết nối mạng trước khi gửi dữ liệu vào DB (lower frequency)
      if (!navigator.onLine) {
        showNotification('Mất kết nối mạng, đang chờ cập nhật vị trí...', true);
        return;
      }
      
      try {
        const timestamp = new Date().toISOString();
        
        // Cache locally for the UI to use instantly
        localStorage.setItem(`last_loc_${userId}`, JSON.stringify([lat, lng]));

        const locationData = {
          user_id: userId,
          lat: lat,
          lng: lng,
          updated_at: timestamp
        };

        // Ưu tiên Upsert dựa trên user_id
        const { error } = await supabase
          .from('locations')
          .upsert(locationData, { onConflict: 'user_id' });
        
        if (error) {
          console.error("Error updating location in DB:", error);
          
          if (error.code === '23502' || error.code === '23505' || error.code === '42P10') {
            console.log("Attempting fallback: Delete then Insert...");
            await supabase.from('locations').delete().eq('user_id', userId);
            await supabase.from('locations').insert(locationData);
          }
        }
      } catch (err) {
        console.error("Location update critical failure:", err);
      }
    };

    let watchId: number;

    const startWatching = () => {
      if ("geolocation" in navigator) {
        watchId = navigator.geolocation.watchPosition(
          async (position) => {
            const { latitude, longitude, accuracy } = position.coords;
            const now = Date.now();

            // Lọc bỏ sai số quá lớn (> 150m) để tránh vị trí nhảy lung tung
            if (accuracy > 150) {
              console.warn(`[GPS] Accuracy too low: ${accuracy}m. Skipping point.`);
              return;
            }

            // Throttling for DB: Update DB every 10s hoặc di chuyển > 2m
            const shouldUpdateDB = () => {
              if (!lastPosRef.current) return true;
              if (now - lastUpdateRef.current > 10000) return true;
              
              const dLat = latitude - lastPosRef.current[0];
              const dLng = longitude - lastPosRef.current[1];
              const distSq = dLat*dLat + dLng*dLng;
              return distSq > 0.0000004; // ~2 meters squared (more efficient check)
            };

            if (shouldUpdateDB()) {
              lastUpdateRef.current = now;
              lastPosRef.current = [latitude, longitude];
              updateLocationInDB(latitude, longitude);
            } else {
              // Vẫn cập nhật Real-time Presence để mượt mà nhất có thể
              updatePresenceLocation(latitude, longitude);
            }

            // Sync accuracy with UI
            window.dispatchEvent(new CustomEvent('location_accuracy', { detail: { accuracy } }));
          },
          (error) => {
            console.warn("Geolocation watch error:", error);
          },
          { enableHighAccuracy: true, maximumAge: 0, timeout: 20000 }
        );
      }
    };

    startWatching();

    // Re-active location sharing when user returns to tab
    const handleVisibility = () => {
      if (document.visibilityState === 'visible') {
        console.log("Tab focused, refreshing location...");
        if ("geolocation" in navigator) {
          navigator.geolocation.getCurrentPosition((pos) => {
            updateLocationInDB(pos.coords.latitude, pos.coords.longitude);
          }, undefined, { enableHighAccuracy: false });
        }
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
