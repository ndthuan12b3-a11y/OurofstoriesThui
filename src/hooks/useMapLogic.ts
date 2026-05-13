import { useState, useMemo, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { usePresence } from '../lib/PresenceContext';
import { cleanAddress } from '../lib/utils';
import { AppConfig } from '../types';

export interface TrackedUser {
  user_id: string;
  lat: number;
  lng: number;
  updated_at: string;
  avatar_url: string | null;
  name: string;
  address: string;
  isOnline: boolean;
}

export const useMapLogic = (userId: string | undefined, config: AppConfig) => {
  const { onlineUsers } = usePresence();
  const [trackedUsers, setTrackedUsers] = useState<Record<string, TrackedUser>>({});

  // Real-time Location Sharing
  useEffect(() => {
    if (!userId || !supabase) return;

    let profilesMap: Record<string, any> = {};
    let creatorId: string | null = null;

    const fetchAllData = async () => {
      try {
        // Fetch Admin/Config creator ID to map male/female names deterministically
        if (!creatorId) {
          const { data: configData } = await supabase.from('config').select('user_id').limit(1).maybeSingle();
          if (configData?.user_id) creatorId = configData.user_id;
        }

        // 1. Fetch Profiles (Only if not already cached)
        if (Object.keys(profilesMap).length === 0) {
          const { data: profiles } = await supabase
            .from('profiles')
            .select('user_id, avatar_url');
          
          if (profiles) {
            profiles.forEach(p => {
              profilesMap[p.user_id] = p;
            });
          }
        }

        // 2. Fetch Locations (Only necessary columns)
        const { data: locations } = await supabase
          .from('locations')
          .select('user_id, lat, lng, updated_at, address');
        
        if (locations) {
          const newTrackedUsers: Record<string, TrackedUser> = {};
          const validLocations = locations.filter(loc => {
            const lat = Number(loc.lat);
            const lng = Number(loc.lng);
            return !isNaN(lat) && !isNaN(lng) && isFinite(lat) && isFinite(lng);
          });

          validLocations.forEach(loc => {
            const profile = profilesMap[loc.user_id];
            let dateStr = loc.updated_at;
            if (dateStr && !dateStr.endsWith('Z') && !dateStr.includes('+')) {
              dateStr += 'Z';
            }
            const isOnline = (Date.now() - new Date(dateStr).getTime()) < 300000; // 5 mins
            
            let name = config.name_male;
            if (creatorId) {
              name = loc.user_id === creatorId ? config.name_female : config.name_male;
            } else {
              const sortedIds = Object.keys(profilesMap).sort();
              if (sortedIds[0] === loc.user_id) name = config.name_female;
              else name = config.name_male;
            }

            newTrackedUsers[loc.user_id] = {
              user_id: loc.user_id,
              lat: Number(loc.lat),
              lng: Number(loc.lng),
              updated_at: loc.updated_at,
              avatar_url: profile?.avatar_url || null,
              name: name || 'Người dùng',
              address: loc.address || '',
              isOnline: isOnline
            };
          });
          setTrackedUsers(newTrackedUsers);
        }
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        console.warn("Fetch initial data failed:", msg);
      }
    };

    fetchAllData();

    // Setup Realtime Listener for locations (DB Changes)
    const dbChannel = supabase
      .channel('location-updates-all')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'locations' },
        async (payload: any) => {
          const loc = payload.new;
          if (!loc) return;
          processUpdate(loc);
        }
      )
      .subscribe();

    // Presence Listener (much faster than DB updates)
    const presenceChannel = supabase.channel('online-users', {
      config: { presence: { key: userId } }
    });

    presenceChannel
      .on('presence', { event: 'sync' }, () => {
        const state = presenceChannel.presenceState();
        Object.entries(state).forEach(([uid, presences]) => {
          const presenceList = presences as any[];
          const latest = presenceList[presenceList.length - 1];
          if (latest && latest.lat && latest.lng) {
            processUpdate({
              user_id: uid,
              lat: latest.lat,
              lng: latest.lng,
              updated_at: latest.online_at || new Date().toISOString(),
              address: latest.address || null 
            });
          }
        });
      })
      .subscribe(async (status) => {
        if (status === 'SUBSCRIBED') {
          // Track our own presence too so others see us fast
          const lastLoc = localStorage.getItem(`last_loc_${userId}`);
          if (lastLoc) {
            const [lat, lng] = JSON.parse(lastLoc);
            await presenceChannel.track({ lat, lng, online_at: new Date().toISOString() });
          }
        }
      });

    // Helper to process any update (DB or Presence)
    const processUpdate = async (loc: any) => {
      const uid = loc.user_id;
      const coords: [number, number] = [Number(loc.lat), Number(loc.lng)];
      
      const isValid = Array.isArray(coords) && coords.length === 2 && 
                      !isNaN(coords[0]) && isFinite(coords[0]) &&
                      !isNaN(coords[1]) && isFinite(coords[1]);
      if (!isValid) return;

      // If tracking a new user, fetch their profile first
      if (!profilesMap[uid]) {
        const { data: profile } = await supabase
          .from('profiles')
          .select('user_id, avatar_url')
          .eq('user_id', uid)
          .maybeSingle();
        if (profile) profilesMap[uid] = profile;
      }

      setTrackedUsers(prev => {
        const profile = profilesMap[uid];
        const prevUser = prev[uid];
        const address = loc.address || prevUser?.address || '';

        let name = config.name_male;
        if (creatorId) {
          name = uid === creatorId ? config.name_female : config.name_male;
        } else {
          const allIds = Object.keys(prev);
          if (!allIds.includes(uid)) allIds.push(uid);
          allIds.sort();
          name = allIds[0] === uid ? config.name_female : config.name_male;
        }

        return {
          ...prev,
          [uid]: {
            user_id: uid,
            lat: coords[0],
            lng: coords[1],
            updated_at: loc.updated_at || new Date().toISOString(),
            avatar_url: profile?.avatar_url || prev[uid]?.avatar_url || null,
            name: name || 'Người dùng',
            address: cleanAddress(address),
            isOnline: true
          }
        };
      });
    };

    const interval = setInterval(fetchAllData, 120000); // 2 mins refresh fallback (Realtime handles precision)

    return () => {
      supabase.removeChannel(dbChannel);
      supabase.removeChannel(presenceChannel);
      clearInterval(interval);
    };
  }, [userId, config.name_male, config.name_female]);

  const sortedUsers = useMemo(() => {
    return Object.values(trackedUsers).sort((a, b) => {
      if (a.user_id === userId) return -1;
      if (b.user_id === userId) return 1;
      return 0;
    });
  }, [trackedUsers, userId]);

  const userLocation = trackedUsers[userId!] ? [trackedUsers[userId!].lat, trackedUsers[userId!].lng] as [number, number] : null;
  const otherUsers = sortedUsers.filter(u => u.user_id !== userId);
  const mainOther = otherUsers[0] || null;
  const otherLocation = mainOther ? [mainOther.lat, mainOther.lng] as [number, number] : null;
  const isOtherOnline = mainOther ? onlineUsers.includes(mainOther.user_id) : false;

  const distance = useMemo(() => {
    if (!userLocation || !otherLocation) return null;
    const [lat1, lon1] = userLocation;
    const [lat2, lon2] = otherLocation;
    const R = 6371; // km
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a = 
      Math.sin(dLat/2) * Math.sin(dLat/2) +
      Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * 
      Math.sin(dLon/2) * Math.sin(dLon/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    const d = R * c;
    return d < 1 ? `${(d * 1000).toFixed(0)}m` : `${d.toFixed(2)}km`;
  }, [userLocation, otherLocation]);

  return {
    trackedUsers,
    sortedUsers,
    userLocation,
    otherUsers,
    mainOther,
    otherLocation,
    isOtherOnline,
    distance,
    onlineUsers
  };
};
