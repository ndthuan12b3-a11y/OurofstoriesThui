import React, { useEffect, useRef } from 'react';
import { supabase } from '../lib/supabase';
import { reverseGeocode } from '../lib/geocoding';
import { usePresence } from '../lib/PresenceContext';

interface LocationSharingProps {
  userId: string;
}

export const LocationSharing: React.FC<LocationSharingProps> = ({ userId }) => {
  const { updateLocation } = usePresence();
  const lastUpdateRef = useRef<number>(0);
  const lastCoordsRef = useRef<{lat: number, lng: number} | null>(null);

  useEffect(() => {
    if (!userId || !supabase) return;

    const updateLocationInDB = async (lat: number, lng: number) => {
      try {
        const address = await reverseGeocode(lat, lng);
        
        // Update presence for real-time smoothness
        updateLocation(lat, lng, address);

        // Update locations table for real-time tracking
        await supabase.from('locations').upsert({
          user_id: userId,
          lat,
          lng,
          address,
          updated_at: new Date().toISOString()
        }, { onConflict: 'user_id' });

      } catch (err) {
        console.error("Location update failed:", err);
      }
    };

    let watchId: number;

    const startWatching = () => {
      if ("geolocation" in navigator) {
        // 1. Lấy vị trí ngay lập tức (phản ứng nhanh) - Cơ chế Fallback thông minh
        const getInitialPos = (useHighAccuracy = true, retryCount = 0) => {
          navigator.geolocation.getCurrentPosition(
            (pos) => updateLocationInDB(pos.coords.latitude, pos.coords.longitude),
            (err) => {
              // Nếu lỗi timeout ở chế độ cao, thử lại với chế độ thấp hơn cho nhanh
              if (useHighAccuracy && (err.code === 3 || err.code === 1)) {
                console.debug("High accuracy failed/timeout, falling back to basic...");
                getInitialPos(false, 0); 
              } else if (retryCount < 1) {
                setTimeout(() => getInitialPos(useHighAccuracy, retryCount + 1), 2000);
              }
            },
            { 
              enableHighAccuracy: useHighAccuracy, 
              timeout: useHighAccuracy ? 10000 : 5000, 
              maximumAge: 5000 
            }
          );
        };
        getInitialPos();

        // 2. Theo dõi liên tục - Cân bằng giữa độ chính xác và tốc độ
        watchId = navigator.geolocation.watchPosition(
          async (position) => {
            const { latitude, longitude, accuracy } = position.coords;
            
            // Vẫn chấp nhận sai số hỗ trợ (Wifi/Cell) để map luôn có điểm
            if (accuracy > 300) return; 

            const shouldUpdateDB = () => {
              const now = Date.now();
              const timeDiff = now - lastUpdateRef.current;
              
              if (!lastCoordsRef.current) return true;
              
              const dist = Math.sqrt(
                Math.pow(latitude - lastCoordsRef.current.lat, 2) + 
                Math.pow(longitude - lastCoordsRef.current.lng, 2)
              );

              // Update if moved significantly or if 1 minute has passed
              return dist > 0.0001 || timeDiff > 60000;
            };

            if (shouldUpdateDB()) {
              lastUpdateRef.current = Date.now();
              lastCoordsRef.current = { lat: latitude, lng: longitude };
              updateLocationInDB(latitude, longitude);
            }
          },
          (error) => {
            const msg = error.code === 1 ? 'Permission Denied' : 
                        error.code === 2 ? 'Position Unavailable' : 
                        error.code === 3 ? 'Timeout' : 
                        String(error);
            console.warn(`Geolocation watch error (Code ${error.code || '?'}): ${msg}`);
          },
          { enableHighAccuracy: true, maximumAge: 5000, timeout: 15000 }
        );
      }
    };

    startWatching();

    // Auto-refresh when app becomes visible again
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        const now = Date.now();
        if (now - lastUpdateRef.current > 30000) { // Nếu đã quá 30 giây chưa update
          navigator.geolocation.getCurrentPosition(
            (pos) => updateLocationInDB(pos.coords.latitude, pos.coords.longitude),
            (err) => {
              if (err.code !== 3) {
                console.debug("Visibility refresh timeout - ignoring");
              }
            },
            { enableHighAccuracy: true, timeout: 10000, maximumAge: 10000 }
          );
        }
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      if (watchId) navigator.geolocation.clearWatch(watchId);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [userId]);

  return null;
};
