import React, { createContext, useContext, useEffect, useState } from 'react';
import { supabase } from './supabase';
import { showNotification } from './notifications';

interface PresenceState {
  onlineUsers: string[];
  isOtherOnline: boolean;
  otherLocation: [number, number] | null;
  sendPing: (message: string) => void;
  updateLocation: (lat: number, lng: number) => void;
}

const PresenceContext = createContext<PresenceState | undefined>(undefined);

export const PresenceProvider: React.FC<{ children: React.ReactNode, userId: string | undefined }> = ({ children, userId }) => {
  const [onlineUsers, setOnlineUsers] = useState<string[]>([]);
  const [isOtherOnline, setIsOtherOnline] = useState(false);
  const [otherLocation, setOtherLocation] = useState<[number, number] | null>(null);
  const channelRef = React.useRef<any>(null);

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
        setIsOtherOnline(users.length > 1);

        // Find other user's location in presence state
        const otherId = users.find(id => id !== userId);
        if (otherId) {
          const presence = state[otherId] as any[];
          if (presence && presence.length > 0) {
            const latest = presence[presence.length - 1];
            if (latest.lat && latest.lng) {
              setOtherLocation([Number(latest.lat), Number(latest.lng)]);
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
      // Real-time Broadcast for Notifications (Pings)
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

  const sendPing = (message: string) => {
    if (channelRef.current) {
      channelRef.current.send({
        type: 'broadcast',
        event: 'ping',
        payload: { message },
      });
    }
  };

  const updateLocation = (lat: number, lng: number) => {
    if (channelRef.current) {
      channelRef.current.track({ 
        lat, 
        lng, 
        online_at: new Date().toISOString() 
      });
    }
  };

  return (
    <PresenceContext.Provider value={{ onlineUsers, isOtherOnline, otherLocation, sendPing, updateLocation }}>
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
