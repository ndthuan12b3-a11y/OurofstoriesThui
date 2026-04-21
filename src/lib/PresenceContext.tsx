import React, { createContext, useContext, useEffect, useState } from 'react';
import { supabase } from './supabase';
import { showNotification } from './notifications';

interface PresenceState {
  onlineUsers: string[];
  isOtherOnline: boolean;
  sendPing: (message: string) => void;
}

const PresenceContext = createContext<PresenceState | undefined>(undefined);

export const PresenceProvider: React.FC<{ children: React.ReactNode, userId: string | undefined }> = ({ children, userId }) => {
  const [onlineUsers, setOnlineUsers] = useState<string[]>([]);
  const [isOtherOnline, setIsOtherOnline] = useState(false);

  useEffect(() => {
    if (!userId) return;

    const channel = supabase.channel('online-users', {
      config: {
        presence: {
          key: userId,
        },
      },
    });

    channel
      .on('presence', { event: 'sync' }, () => {
        const state = channel.presenceState();
        const users = Object.keys(state);
        setOnlineUsers(users);
        setIsOtherOnline(users.length > 1);
      })
      .on('presence', { event: 'join' }, ({ key }) => {
        if (key !== userId) {
          showNotification("Người ấy vừa online! ❤️");
        }
      })
      .on('presence', { event: 'leave' }, ({ key }) => {
        if (key !== userId) {
          showNotification("Người ấy đã offline. 🌙");
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
    };
  }, [userId]);

  const sendPing = (message: string) => {
    supabase.channel('online-users').send({
      type: 'broadcast',
      event: 'ping',
      payload: { message },
    });
  };

  return (
    <PresenceContext.Provider value={{ onlineUsers, isOtherOnline, sendPing }}>
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
