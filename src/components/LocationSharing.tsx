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
        // Cache locally for the UI to use instantly
        localStorage.setItem(`last_loc_${userId}`, JSON.stringify([lat, lng]));

        const response = await fetch('/api/location/update', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            user_id: userId,
            lat: lat,
            lng: lng
          })
        });

        if (!response.ok) {
          const errData = await response.json().catch(() => ({}));
          console.error("API update error:", errData);
        }
      } catch (err) {
        console.error("Location update API failure:", err);
      }
    };

    let watchId: number;

    const startWatching = () => {
      if ("geolocation" in navigator) {
        // 1. Lấy vị trí ngay lập tức (phản ứng nhanh)
        navigator.geolocation.getCurrentPosition(
          (pos) => updateLocationInDB(pos.coords.latitude, pos.coords.longitude),
          (err) => console.warn("Initial position error:", err),
          { enableHighAccuracy: false, timeout: 5000, maximumAge: 60000 }
        );

        // 2. Theo dõi liên tục (độ chính xác cao)
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
              return distSq > 0.0000000005; // ~2 meters squared (increased sensitivity)
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
          navigator.geolocation.getCurrentPosition(
            (pos) => updateLocationInDB(pos.coords.latitude, pos.coords.longitude),
            (err) => console.warn("Visibility refresh error:", err),
            { enableHighAccuracy: true, timeout: 5000, maximumAge: 0 }
          );
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
