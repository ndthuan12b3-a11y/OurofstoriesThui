import React, { createContext, useContext, useEffect, useState } from 'react';
import { supabase } from './supabase';
import { showNotification } from './notifications';

interface PresenceState {
  onlineUsers: string[];
  isOtherOnline: boolean;
  otherLocation: [number, number] | null;
  sendPing: (message: string) => void;
  updateLocation: (lat: number, lng: number, address?: string) => void;
}

const PresenceContext = createContext<PresenceState | undefined>(undefined);
const CACHE_KEY_OTHER_LOC = 'last_known_other_location';

export const PresenceProvider: React.FC<{ children: React.ReactNode, userId: string | undefined }> = ({ children, userId }) => {
  const [onlineUsers, setOnlineUsers] = useState<string[]>([]);
  const [isOtherOnline, setIsOtherOnline] = useState(false);
  const [isOtherActiveRecent, setIsOtherActiveRecent] = useState(false);
  const [otherLocation, setOtherLocation] = useState<[number, number] | null>(() => {
    try {
      const cached = localStorage.getItem(CACHE_KEY_OTHER_LOC);
      return cached ? JSON.parse(cached) : null;
    } catch { return null; }
  });
  const channelRef = React.useRef<any>(null);
  const lastThrottleRef = React.useRef<number>(0);
  const lastPendingRef = React.useRef<[number, number] | null>(null);

  useEffect(() => {
    if (!userId) return;

    const fetchOtherStatus = async () => {
      // Find the most recent location update from anyone else
      const { data, error } = await supabase
        .from('locations')
        .select('lat, lng, updated_at')
        .neq('user_id', userId)
        .order('updated_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (data && !error) {
        const lastUpdate = new Date(data.updated_at).getTime();
        const now = Date.now();
        
        // If updated in the last 10 minutes, count as "Active" or "Online"
        const isActive = (now - lastUpdate) < 10 * 60 * 1000;
        setIsOtherActiveRecent(isActive);
        
        if (data.lat !== undefined && data.lng !== undefined) {
          setOtherLocation([data.lat, data.lng]);
        }
      } else {
        setIsOtherActiveRecent(false);
      }
    };

    fetchOtherStatus();
    const interval = setInterval(fetchOtherStatus, 300000); // Poll every 5 mins
    return () => clearInterval(interval);
  }, [userId]);

  useEffect(() => {
    if (!userId) return;

    const channel = supabase.channel('online-users', {
      config: {
        presence: {
          key: userId,
        },
      },
    });

    channelRef.current = channel;

    channel
      .on('presence', { event: 'sync' }, () => {
        const state = channel.presenceState();
        const users = Object.keys(state);
        setOnlineUsers(users);
        setIsOtherOnline(users.some(id => id !== userId));

        // Find other user's location in presence state
        const otherId = users.find(id => id !== userId);
        if (otherId) {
          const presence = state[otherId] as any[];
          if (presence && presence.length > 0) {
            const latest = presence[presence.length - 1];
            if (latest.lat !== undefined && latest.lng !== undefined) {
              const lat = Number(latest.lat);
              const lng = Number(latest.lng);
              
              if (!isNaN(lat) && !isNaN(lng)) {
                const newPos: [number, number] = [lat, lng];
                
                // Simple local throttle for UI updates
                const now = Date.now();
                if (!lastThrottleRef.current || now - lastThrottleRef.current > 300) {
                  setOtherLocation(newPos);
                  localStorage.setItem(CACHE_KEY_OTHER_LOC, JSON.stringify(newPos));
                  lastThrottleRef.current = now;
                  lastPendingRef.current = null;
                } else {
                  lastPendingRef.current = newPos;
                }
              }
            }
          }
        }
      })
      .on('presence', { event: 'join' }, ({ key }) => {
        if (key !== userId) {
          showNotification("Người ấy vừa online! ❤️");
        }
      })
      .on('presence', { event: 'leave' }, ({ key }) => {
        if (key !== userId) {
          showNotification("Người ấy đã offline. 🌙");
          setOtherLocation(null);
        }
      })
      .on('broadcast', { event: 'ping' }, ({ payload }) => {
        showNotification(`Thông báo: ${payload.message}`, false);
      })
      .subscribe(async (status) => {
        if (status === 'SUBSCRIBED') {
          await channel.track({ online_at: new Date().toISOString() });
        }
      });

    return () => {
      channel.unsubscribe();
      channelRef.current = null;
    };
  }, [userId]);

  // Periodic check to apply pending throttled updates
  useEffect(() => {
    const interval = setInterval(() => {
      if (lastPendingRef.current) {
        setOtherLocation(lastPendingRef.current);
        lastPendingRef.current = null;
        lastThrottleRef.current = Date.now();
      }
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  const sendPing = (message: string) => {
    if (channelRef.current) {
      channelRef.current.send({
        type: 'broadcast',
        event: 'ping',
        payload: { message },
      });
    }
  };

  const lastTrackRef = React.useRef<number>(0);
  const updateLocation = (lat: number, lng: number, address?: string) => {
    const now = Date.now();
    // Throttle track calls
    if (channelRef.current && now - lastTrackRef.current > 800) {
      lastTrackRef.current = now;
      const data: any = { 
        lat, 
        lng, 
        online_at: new Date().toISOString() 
      };
      if (address) data.address = address;
      channelRef.current.track(data).catch(() => {});
    }
  };

  return (
    <PresenceContext.Provider value={{ 
      onlineUsers, 
      isOtherOnline: isOtherOnline || isOtherActiveRecent, 
      otherLocation, 
      sendPing, 
      updateLocation 
    }}>
      {children}
    </PresenceContext.Provider>
  );
};

export const usePresence = () => {
  const context = useContext(PresenceContext);
  if (context === undefined) {
    throw new Error('usePresence must be used within a PresenceProvider');
  }
  return context;
};
