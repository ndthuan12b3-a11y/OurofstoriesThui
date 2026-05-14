import { useState, useMemo, useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';
import { usePresence } from '../lib/PresenceContext';
import { cleanAddress } from '../lib/utils';
import { AppConfig } from '../types';

interface TrackedUser {
  user_id: string;
  lat: number;
  lng: number;
  updated_at: string;
  avatar_url: string | null;
  name: string;
  address: string;
  isOnline: boolean;
}

const CACHE_KEY_TRACKED_USERS = 'last_known_tracked_users_map';

export const useMapLogic = (userId: string | undefined, config: AppConfig) => {
  const { onlineUsers } = usePresence();
  const queryClient = useQueryClient();
  
  // 1. Initial State from LocalStorage for immediate display
  const [trackedUsers, setTrackedUsers] = useState<Record<string, TrackedUser>>(() => {
    try {
      const cached = localStorage.getItem(CACHE_KEY_TRACKED_USERS);
      return cached ? JSON.parse(cached) : {};
    } catch { return {}; }
  });

  // 2. Fetch Profiles using React Query
  const { data: profilesMap = {} } = useQuery({
    queryKey: ['profiles-map'],
    queryFn: async () => {
      const { data } = await supabase.from('profiles').select('user_id, avatar_url');
      const map: Record<string, any> = {};
      data?.forEach(p => { map[p.user_id] = p; });
      return map;
    },
    enabled: !!userId,
  });

  // 3. Fetch Config Creator using React Query
  const { data: creatorId } = useQuery({
    queryKey: ['config-creator'],
    queryFn: async () => {
      const { data } = await supabase.from('config').select('user_id').limit(1).maybeSingle();
      return data?.user_id || null;
    },
    enabled: !!userId,
  });

  // 4. Baseline locations using React Query (Refreshes periodically)
  const { data: initialLocations } = useQuery({
    queryKey: ['locations-baseline'],
    queryFn: async () => {
      const { data: locations } = await supabase
        .from('locations')
        .select('user_id, lat, lng, updated_at, address');
      return locations || [];
    },
    enabled: !!userId && Object.keys(profilesMap).length > 0,
    staleTime: 60000,
  });

  // Update tracked users when baseline locations or online status change
  useEffect(() => {
    if (!initialLocations) return;

    setTrackedUsers(prev => {
      const newTrackedUsers: Record<string, TrackedUser> = { ...prev };
      
      initialLocations.forEach(loc => {
        const uid = loc.user_id;
        const profile = profilesMap[uid];
        let name = config.name_male;
        
        if (creatorId) {
          name = uid === creatorId ? config.name_female : config.name_male;
        } else {
          const sortedIds = Object.keys(profilesMap).sort();
          if (sortedIds.includes(uid)) {
            name = sortedIds[0] === uid ? config.name_female : config.name_male;
          }
        }

        // Only update from DB if we don't have a more recent real-time update in state
        const existing = prev[uid];
        const dbTime = new Date(loc.updated_at).getTime();
        const existingTime = existing ? new Date(existing.updated_at).getTime() : 0;
        
        const lat = Number(loc.lat);
        const lng = Number(loc.lng);

        if (!isNaN(lat) && !isNaN(lng) && (!existing || dbTime >= existingTime)) {
          newTrackedUsers[uid] = {
            user_id: uid,
            lat,
            lng,
            updated_at: loc.updated_at || new Date().toISOString(),
            avatar_url: profile?.avatar_url || null,
            name: name || 'Người dùng',
            address: cleanAddress(loc.address || ''),
            isOnline: onlineUsers.includes(uid)
          };
        } else {
          // If we have more recent real-time data, just update the online status
          newTrackedUsers[uid] = {
            ...existing,
            isOnline: onlineUsers.includes(uid)
          };
        }
      });

      // Save to localStorage
      localStorage.setItem(CACHE_KEY_TRACKED_USERS, JSON.stringify(newTrackedUsers));
      return newTrackedUsers;
    });
  }, [initialLocations, profilesMap, onlineUsers, creatorId, config.name_male, config.name_female]);

  // Real-time Presence Listener
  useEffect(() => {
    if (!userId || !supabase) return;

    // 1. Lắng nghe thay đổi trực tiếp từ Bảng Locations (Độ tin cậy cao)
    const locationsChannel = supabase
      .channel('db-locations')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'locations' },
        (payload) => handleLocationUpdate(payload.new)
      )
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'locations' },
        (payload) => handleLocationUpdate(payload.new)
      )
      .subscribe();

    const handleLocationUpdate = (loc: any) => {
      const uid = loc.user_id;
      const profile = profilesMap[uid];
      let name = config.name_male;
      if (creatorId) {
        name = uid === creatorId ? config.name_female : config.name_male;
      }

      setTrackedUsers(prev => {
        const existing = prev[uid];
        const dbTime = new Date(loc.updated_at).getTime();
        const existingTime = existing ? new Date(existing.updated_at).getTime() : 0;

        const lat = Number(loc.lat);
        const lng = Number(loc.lng);
        
        if (isNaN(lat) || isNaN(lng)) return prev;

        // Chỉ cập nhật nếu dữ liệu mới hơn (tránh race condition với Presence)
        if (!existing || dbTime >= existingTime - 1000) {
          const updated = {
            user_id: uid,
            lat,
            lng,
            updated_at: loc.updated_at || new Date().toISOString(),
            avatar_url: profile?.avatar_url || null,
            name: name || 'Người dùng',
            address: cleanAddress(loc.address || ''),
            isOnline: onlineUsers.includes(uid)
          };
          
          const merged = { ...prev, [uid]: updated };
          localStorage.setItem(CACHE_KEY_TRACKED_USERS, JSON.stringify(merged));
          return merged;
        }
        return prev;
      });
    };

    // 2. Lắng nghe Presence (Độ trễ thấp cho di chuyển mượt)
    const presenceChannel = supabase.channel('online-users', {
      config: { presence: { key: userId } }
    });

    presenceChannel
      .on('presence', { event: 'sync' }, () => {
        const state = presenceChannel.presenceState();
        
        setTrackedUsers(prev => {
          const merged = { ...prev };
          // Mark as offline if not in current presence state
          Object.keys(merged).forEach(uid => { merged[uid].isOnline = onlineUsers.includes(uid); });

          Object.entries(state).forEach(([uid, presences]) => {
            const presenceList = presences as any[];
            const latest = presenceList[presenceList.length - 1];
            
            if (latest && latest.lat !== undefined && latest.lng !== undefined) {
              const lat = Number(latest.lat);
              const lng = Number(latest.lng);
              
              if (!isNaN(lat) && !isNaN(lng)) {
                const profile = profilesMap[uid];
                let name = config.name_male;
                if (creatorId) {
                  name = uid === creatorId ? config.name_female : config.name_male;
                }

                merged[uid] = {
                  user_id: uid,
                  lat,
                  lng,
                  updated_at: latest.online_at || new Date().toISOString(),
                  avatar_url: profile?.avatar_url || null,
                  name: name || 'Người dùng',
                  address: cleanAddress(latest.address || ''),
                  isOnline: true
                };
              }
            }
          });
          
          localStorage.setItem(CACHE_KEY_TRACKED_USERS, JSON.stringify(merged));
          return merged;
        });
      })
      .subscribe();

    return () => {
      supabase.removeChannel(locationsChannel);
      supabase.removeChannel(presenceChannel);
    };
  }, [userId, profilesMap, creatorId, config, onlineUsers]);

  const sortedUsers = useMemo(() => {
    return Object.values(trackedUsers).sort((a, b) => {
      if (a.isOnline !== b.isOnline) return a.isOnline ? -1 : 1;
      return new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime();
    });
  }, [trackedUsers]);

  return { trackedUsers, sortedUsers };
};
