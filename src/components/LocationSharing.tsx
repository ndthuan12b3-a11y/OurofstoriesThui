import React from 'react';
import { supabase } from '../lib/supabase';
import { showNotification } from '../lib/notifications';
import { usePresence } from '../lib/PresenceContext';
import { reverseGeocode } from '../lib/geocoding';

interface LocationSharingProps {
  userId: string;
}

export const LocationSharing: React.FC<LocationSharingProps> = ({ userId }) => {
  const lastUpdateRef = React.useRef<number>(0);
  const lastGeocodeRef = React.useRef<number>(0);
  const lastAddrRef = React.useRef<string>("");
  const lastPosRef = React.useRef<[number, number] | null>(null);
  const { updateLocation: updatePresenceLocation } = usePresence();

  React.useEffect(() => {
    if (!userId || !supabase) return;

    const updateLocationInDB = async (lat: number, lng: number) => {
      if (!lat || !lng || isNaN(lat) || isNaN(lng)) return;
      
      const now = Date.now();
      const movedFar = lastPosRef.current && 
        (Math.abs(lat - lastPosRef.current[0]) > 0.0003 || Math.abs(lng - lastPosRef.current[1]) > 0.0003);

      // 1. Cập nhật toạ độ lên Presence NGAY LẬP TỨC
      updatePresenceLocation(lat, lng, lastAddrRef.current);

      // 2. Chạy tìm địa chỉ ngầm
      const isFirstRun = !lastPosRef.current;
      if (isFirstRun || now - lastGeocodeRef.current > 30000 || movedFar) {
        lastGeocodeRef.current = now;
        reverseGeocode(lat, lng).then(newAddr => {
          if (newAddr && newAddr !== lastAddrRef.current) {
            lastAddrRef.current = newAddr;
            // Cập nhật Presence ngay cho mọi người thấy
            updatePresenceLocation(lat, lng, newAddr);
            
            // Đồng bộ luôn vào DB để lưu trữ lâu dài
            if (navigator.onLine) {
              fetch('/api/location/update', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ user_id: userId, lat, lng, address: newAddr })
              }).catch(() => {});
            }
          }
        }).catch(() => {});
      }

      // 3. Database Sync (Throttled)
      if (!navigator.onLine) return;
      if (now - lastUpdateRef.current > 10000 || movedFar || !lastPosRef.current) {
        lastUpdateRef.current = now;
        lastPosRef.current = [lat, lng];
        const body = { user_id: userId, lat, lng, address: lastAddrRef.current || undefined };
        
        fetch('/api/location/update', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body)
        }).catch(() => {
          // Fallback direct
          supabase.from('locations').upsert({
            user_id: userId, lat, lng, address: lastAddrRef.current || null,
            updated_at: new Date().toISOString()
          }, { onConflict: 'user_id' });
        });
      }
    };

    let watchId: number;

    const startWatching = () => {
      if ("geolocation" in navigator) {
        // 1. Lấy vị trí ngay lập tức (phản ứng nhanh)
        navigator.geolocation.getCurrentPosition(
          (pos) => updateLocationInDB(pos.coords.latitude, pos.coords.longitude),
          (err) => {
            if (err.code !== 3) {
               console.warn(`Initial position error (Code ${err.code}): ${err.message}`);
            }
          },
          { enableHighAccuracy: false, timeout: 8000, maximumAge: 60000 }
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

            // Throttling for DB: Update DB every 30s hoặc di chuyển > 10m
            const shouldUpdateDB = () => {
              if (!lastPosRef.current) return true;
              if (now - lastUpdateRef.current > 30000) return true;
              
              const dLat = latitude - lastPosRef.current[0];
              const dLng = longitude - lastPosRef.current[1];
              const distSq = dLat*dLat + dLng*dLng;
              return distSq > 0.00000001; // ~10 meters squared (decreased sensitivity for DB writes)
            };

            if (shouldUpdateDB()) {
              lastUpdateRef.current = now;
              lastPosRef.current = [latitude, longitude];
              updateLocationInDB(latitude, longitude);
            } else {
              // Vẫn cập nhật Real-time Presence để mượt mà nhất có thể
              updatePresenceLocation(latitude, longitude, lastAddrRef.current);
            }

            // Sync accuracy with UI
            window.dispatchEvent(new CustomEvent('location_accuracy', { detail: { accuracy } }));
          },
          (error) => {
            const msg = error instanceof Error ? error.message : 
                        (typeof error === 'object' && error !== null && 'message' in error) ? (error as any).message : 
                        String(error);
            console.warn(`Geolocation watch error (Code ${error.code || '?'}): ${msg}`);
          },
          { enableHighAccuracy: true, maximumAge: 10000, timeout: 10000 }
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
            (err) => {
              const msg = err instanceof Error ? err.message : String(err);
              if (err.code !== 3) { // 3 is Timeout, which is common on mobile wake-up
                console.warn(`Visibility refresh error: ${msg}`);
              } else {
                console.debug("Visibility refresh timeout - ignoring");
              }
            },
            { enableHighAccuracy: true, timeout: 8000, maximumAge: 0 }
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
