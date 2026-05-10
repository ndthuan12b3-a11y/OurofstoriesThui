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
      
      // Kiểm tra kết nối mạng trước khi gửi dữ liệu
      if (!navigator.onLine) {
        showNotification('Mất kết nối mạng, đang chờ cập nhật vị trí...', true);
        return;
      }
      
      try {
        const timestamp = new Date().toISOString();
        
        // Cache locally for the UI to use instantly
        localStorage.setItem(`last_loc_${userId}`, JSON.stringify([lat, lng]));

        // Chuẩn hóa dữ liệu: Loại bỏ hoàn toàn trường 'id' cũ
        const locationData = {
          user_id: userId,
          lat: lat,
          lng: lng,
          updated_at: new Date().toISOString()
        };

        // Ưu tiên Upsert dựa trên user_id
        const { error } = await supabase
          .from('locations')
          .upsert(locationData, { onConflict: 'user_id' });
        
        if (error) {
          console.error("Error updating location in DB:", error);
          
          // Fallback: Nếu Upsert thất bại (do DB cũ chưa cập nhật constraint), 
          // thực hiện Xóa rồi Thêm mới để đảm bảo tính nhất quán
          if (error.code === '23502' || error.code === '23505' || error.code === '42P10') {
            console.log("Attempting fallback: Delete then Insert...");
            await supabase
              .from('locations')
              .delete()
              .eq('user_id', userId);
              
            const { error: insertError } = await supabase
              .from('locations')
              .insert(locationData);
            
            if (insertError) {
              console.error("Critical fallback insert failed:", insertError);
            }
          }
        }
      } catch (err) {
        console.error("Location update critical failure:", err);
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

    const startWatching = () => {
      if ("geolocation" in navigator) {
        watchId = navigator.geolocation.watchPosition(
          async (position) => {
            const { latitude, longitude } = position.coords;
            const now = Date.now();

            // Throttling: Update DB every 10s hoặc di chuyển > 2m
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
