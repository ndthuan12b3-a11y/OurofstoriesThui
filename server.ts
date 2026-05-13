import express from "express";
import { createServer as createViteServer } from "vite";
import { createClient } from "@supabase/supabase-js";
import path from "path";
import dotenv from "dotenv";
import axios from "axios";

// Load environment variables
dotenv.config();

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error("VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY is missing in environment variables.");
}

const supabase = createClient(supabaseUrl || '', supabaseServiceKey || '');

// Helper to check if string is a valid UUID
const isUUID = (id: string) => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(String(id));

/**
 * Helper to clean up redundant location history
 * If the current address is the same as the previous one for this user,
 * we merge them to optimize storage.
 */
async function cleanupRedundantHistory(userId: string, address: string) {
  if (!address || address.length < 5) return;

  try {
    // Find the 2 most recent records for this user (the one we just inserted and the one before it)
    const { data: recentRecords, error } = await supabase
      .from('location_history')
      .select('id, address, timestamp')
      .eq('user_id', userId)
      .order('timestamp', { ascending: false })
      .limit(2);

    if (!error && recentRecords && recentRecords.length === 2) {
      const [newest, previous] = recentRecords;
      
      // If the address is identical, merge them
      if (newest.address === previous.address && newest.address === address) {
        console.log(`[Optimization] Merging redundant records for user ${userId} at address: ${address}`);
        
        // Update the previous record with the newest timestamp
        await supabase
          .from('location_history')
          .update({ timestamp: newest.timestamp })
          .eq('id', previous.id);
          
        // Delete the redundant newest record
        await supabase
          .from('location_history')
          .delete()
          .eq('id', newest.id);
      }
    }
  } catch (err) {
    console.error("[Optimization] Error cleaning up history:", err);
  }
}

async function startServer() {
  const app = express();
  const PORT = 3000;

  // Middleware to parse JSON and URL-encoded bodies
  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));

  /**
   * API Route for Traccar Client
   * Traccar Client sends data via HTTP GET or POST.
   * Typical parameters: id, lat, lon, timestamp, altitude, speed, bearing, batt.
   */
  app.all("/api/traccar", async (req, res) => {
    // Combine query parameters (GET) and body data (POST)
    const data = { ...req.query, ...req.body };
    
    // Extract core fields with multiple possible mappings for different clients (Traccar, FlowLocate, etc.)
    const id = data.id || data.uniqueId || data.deviceId || data.deviceid || data.userId || data.user_id;
    const lat = data.lat || data.latitude || data.location?.lat || data.location?.latitude;
    const lon = data.lon || data.longitude || data.lng || data.location?.lng || data.location?.longitude;
    const timestamp = data.timestamp || data.time || data.tst || data.updated_at || data.location?.timestamp;
    const clientAddress = data.address || data.location?.address || data.addr;

    console.log(`[Incoming Location] Client: ${req.headers['user-agent'] || 'Unknown'}, ID: ${id}`);

    if (!id || !lat || !lon) {
      console.warn("[Traccar API] Missing core parameters (id, lat, lon)");
      return res.status(200).send("OK: Missing parameters");
    }

    try {
      const latitude = parseFloat(lat as string);
      const longitude = parseFloat(lon as string);

      if (isNaN(latitude) || isNaN(longitude)) {
        return res.status(200).send("OK: Invalid coordinates");
      }

      // Robust timestamp parsing
      let updatedAt = new Date().toISOString();
      if (timestamp) {
        const tsStr = timestamp as string;
        const dateVal = new Date(tsStr);
        if (!isNaN(dateVal.getTime())) {
          updatedAt = dateVal.toISOString();
        } else {
          const tsValue = parseInt(tsStr);
          if (!isNaN(tsValue)) {
            // Traccar Client (Android/iOS) usually sends seconds (10 digits) or milliseconds (13 digits)
            updatedAt = new Date(tsValue < 10000000000 ? tsValue * 1000 : tsValue).toISOString();
          }
        }
      }

      console.log(`[Traccar API] ${new Date().toISOString()} - Device ID: ${id}, Position: ${latitude}, ${longitude}`);

      // Perform primary upsert into 'locations' table IMMEDIATELY for speed (ONLY if UUID)
      if (isUUID(id)) {
        const upsertData: any = {
          user_id: id,
          lat: latitude,
          lng: longitude,
          updated_at: updatedAt,
        };

        if (clientAddress) {
          upsertData.address = clientAddress;
        }

        const { error: upsertError } = await supabase
          .from('locations')
          .upsert(upsertData, { onConflict: 'user_id' });

        if (upsertError) {
          console.error("[Traccar API] locations table error:", upsertError.message);
        }
      }

        // 1. Check movement before saving to history (Use string ID if UUID not required for history)
        const { data: lastHistory } = await supabase
          .from('location_history')
          .select('id, lat, lng, timestamp')
          .filter('user_id', 'eq', id) // Filter works with strings too
          .order('timestamp', { ascending: false })
          .limit(1)
          .maybeSingle();

      let shouldInsertHistory = true;
      let historyIdToUpdate = null;

      if (lastHistory) {
        const dLat = Math.abs(latitude - Number(lastHistory.lat));
        const dLng = Math.abs(longitude - Number(lastHistory.lng));
        
        // If moved less than ~10m (0.0001 degrees)
        if (dLat < 0.0001 && dLng < 0.0001) {
          shouldInsertHistory = false;
          historyIdToUpdate = lastHistory.id;
        }
      }

      if (shouldInsertHistory) {
        try {
          await supabase
            .from('location_history')
            .insert({
              user_id: id,
              lat: latitude,
              lng: longitude,
              timestamp: updatedAt,
              address: clientAddress || null
            });
        } catch (hErr) {}
      } else if (historyIdToUpdate) {
        // Just update existing history timestamp to extend stay duration
        try {
          await supabase
            .from('location_history')
            .update({ timestamp: updatedAt })
            .eq('id', historyIdToUpdate);
        } catch (upErr) {}
      }

      // Start background geocoding WITHOUT awaiting it
      if (!clientAddress) {
        (async () => {
          try {
          // 1. GLOBAL Address Cache: Find ANY nearby record with a detailed address
          // Search within 10m radius for high precision house numbers
          const { data: nearbyCache } = await supabase
            .from('location_history')
            .select('address')
            .not('address', 'is', null)
            .gte('lat', latitude - 0.0001)
            .lte('lat', latitude + 0.0001)
            .gte('lng', longitude - 0.0001)
            .lte('lng', longitude + 0.0001)
            .order('timestamp', { ascending: false })
            .limit(1)
            .maybeSingle();

          if (nearbyCache && (nearbyCache as any).address) {
            const cachedAddr = (nearbyCache as any).address;
            console.log(`[Traccar API] Cache Hit (Precision): ${cachedAddr}`);
            if (isUUID(id)) {
              await supabase.from('locations').update({ address: cachedAddr }).eq('user_id', id);
            }
            
            // Tag current history too
            if (shouldInsertHistory) {
               await supabase.from('location_history').update({ address: cachedAddr }).eq('user_id', id).eq('timestamp', updatedAt);
            } else if (historyIdToUpdate) {
               await supabase.from('location_history').update({ address: cachedAddr }).eq('id', historyIdToUpdate);
            }
            return;
          }

          // 2. Fetch current status to avoid redundant geocoding if tiny move
          const { data: currentLoc } = await supabase
            .from('locations')
            .select('*')
            .eq('user_id', id)
            .maybeSingle();

          if (currentLoc && (currentLoc as any).address && currentLoc.lat && currentLoc.lng) {
            const dLat = latitude - Number(currentLoc.lat);
            const dLng = longitude - Number(currentLoc.lng);
            const distSq = (dLat * dLat) + (dLng * dLng);
            if (distSq < 0.0000000002) return; 
          }

          const response = await axios.get(
            `https://nominatim.openstreetmap.org/reverse?format=json&lat=${latitude}&lon=${longitude}&zoom=18&addressdetails=1&accept-language=vi&email=AlanwalkerT2002@gmail.com`,
            {
              headers: { 'User-Agent': `Location-Tracker-App-AI-Studio-${id}` },
              timeout: 5000
            }
          );
          
          if (response.status === 200) {
            const geoData = response.data;
            const addr = geoData.address || {};
            
            const house = addr.house_number || addr.building || addr.house_name || addr.office || addr.apartment || addr.flat || addr.street_number || addr.unit || addr.room;
            const street = addr.road || addr.pedestrian || addr.path || addr.street || addr.lane || addr.cycleway || addr.footway;
            const area = addr.suburb || addr.neighbourhood || addr.village || addr.quarter || addr.hamlet || addr.croft || addr.city_district;

            let finalAddress = "";
            if (house && street) {
              const formattedHouse = /^\d/.test(house) && !house.toLowerCase().includes('số') ? `Số ${house}` : house;
              const formattedStreet = !street.toLowerCase().includes('đường') && !street.toLowerCase().includes('phố') ? `Đường ${street}` : street;
              finalAddress = `${formattedHouse} ${formattedStreet}`;
            } else if (house) {
              finalAddress = /^\d/.test(house) && !house.toLowerCase().includes('số') ? `Số ${house}` : house;
            } else if (street) {
              finalAddress = !street.toLowerCase().includes('đường') && !street.toLowerCase().includes('phố') ? `Đường ${street}` : street;
            } else if (area) {
              finalAddress = area;
            }

            const display = geoData.display_name ? geoData.display_name.split(',').slice(0, 3).map((s: string) => s.trim()).join(', ') : "";
            if (!finalAddress) finalAddress = display || "Vị trí chưa xác định";
            
            if (finalAddress) {
              console.log(`[Traccar API] Detailed Address: ${finalAddress}`);
              // Sync latest location
              if (isUUID(id)) {
                await supabase.from('locations').update({ address: finalAddress }).eq('user_id', id);
              }
              
              // Sync history (including recent ones without address)
              await supabase.from('location_history')
                .update({ address: finalAddress })
                .eq('user_id', id)
                .is('address', null)
                .gte('lat', latitude - 0.0005)
                .lte('lat', latitude + 0.0005);

              // NEW: Optimization - merge redundant consecutive addresses
              await cleanupRedundantHistory(id, finalAddress);
            }
          }
        } catch (geoErr) {
          console.warn("[Traccar API] Geocoding background error:", (geoErr as Error).message);
        }
      })();
    }

      // Respond "OK" immediately to Traccar Client
      res.status(200).send("OK");
    } catch (err) {
      console.error("[Traccar API] Critical error:", err);
      res.status(500).send("Internal server error");
    }
  });

  /**
   * API Route for Browser-based updates
   * Unifies geocoding logic with Traccar logic.
   */
  app.post("/api/location/update", express.json(), async (req, res) => {
    try {
      if (!req.body) {
        console.warn("[API Update] Received empty body");
        return res.status(400).json({ error: "Empty body" });
      }

      const { user_id, lat, lng, address: clientAddress } = req.body;
      console.log(`[API Update] Request from: ${user_id}, pos: ${lat}, ${lng}`);

      if (!user_id || lat === undefined || lng === undefined) {
        return res.status(400).json({ error: "Missing parameters", received: Object.keys(req.body) });
      }

      const latitude = Number(lat);
      const longitude = Number(lng);

      if (isNaN(latitude) || isNaN(longitude)) {
        return res.status(400).json({ error: "Invalid coordinates", lat, lng });
      }

      // 1. Fetch current to see if we really need to update everything
      let current: any = null;
      let hasAddressColumn = true;

      // Try selecting with address first (detect column)
      const { data: dataWithAddr, error: selectError } = await supabase.from('locations').select('lat, lng, address').eq('user_id', user_id).maybeSingle();
      
      if (selectError) {
        if (selectError.code === '42703' || selectError.message?.includes('address')) {
          hasAddressColumn = false;
          const { data: dataNoAddr, error: selectErrorNoAddr } = await supabase.from('locations').select('lat, lng').eq('user_id', user_id).maybeSingle();
          if (!selectErrorNoAddr) current = dataNoAddr;
        } else if (selectError.code === '42P01') {
          console.error("[API Update] Table 'locations' does not exist. Please create it in Supabase.");
        } else {
          console.error("[API Update] Supabase Select Error:", selectError.message);
        }
      } else {
        current = dataWithAddr;
      }

      const dLat = Math.abs(latitude - (current?.lat || 0));
      const dLng = Math.abs(longitude - (current?.lng || 0));
      const moved = dLat > 0.00001 || dLng > 0.00001; 

      // 2. Update coordinates and maybe address (ONLY if UUID)
      if (isUUID(user_id)) {
        const upsertData: any = {
          user_id,
          lat: latitude,
          lng: longitude,
          updated_at: new Date().toISOString()
        };
        
        if (hasAddressColumn && clientAddress && clientAddress.length > 5) {
          upsertData.address = clientAddress;
        }

        const { error: upsertError } = await supabase
          .from('locations')
          .upsert(upsertData, { onConflict: 'user_id' });

        if (upsertError) {
          if (hasAddressColumn && (upsertError.code === '42703' || upsertError.message?.includes('address'))) {
             delete upsertData.address;
             await supabase.from('locations').upsert(upsertData, { onConflict: 'user_id' });
          } else {
            console.error("[API Update] Supabase Upsert Error:", upsertError.message);
          }
        }
      }

      // 3. Save to history or update timestamp if standing still
      const { data: lastH } = await supabase
        .from('location_history')
        .select('id, lat, lng, timestamp')
        .filter('user_id', 'eq', user_id)
        .order('timestamp', { ascending: false })
        .limit(1)
        .maybeSingle();

      let shouldInsertH = true;
      let hIdToUpdate = null;

      if (lastH) {
        const dLatH = Math.abs(latitude - Number(lastH.lat));
        const dLngH = Math.abs(longitude - Number(lastH.lng));
        if (dLatH < 0.0001 && dLngH < 0.0001) {
          shouldInsertH = false;
          hIdToUpdate = lastH.id;
        }
      }

      if (shouldInsertH) {
        try {
          await supabase.from('location_history').insert({
            user_id,
            lat: latitude,
            lng: longitude,
            address: clientAddress || null,
            timestamp: new Date().toISOString()
          });
        } catch (hErr) {}
      } else if (hIdToUpdate) {
        try {
          await supabase.from('location_history').update({ timestamp: new Date().toISOString() }).eq('id', hIdToUpdate);
        } catch (upErr) {}
      }

      // 3. Respond immediately
      res.json({ status: "ok" });

      // 4. Background Geocoding (only if no clientAddress provided OR moved significantly)
      if (!clientAddress || moved) {
        (async () => {
          try {
            // Check cache first
            const { data: nearby } = await supabase
              .from('location_history')
              .select('address')
              .not('address', 'is', null)
              .gte('lat', latitude - 0.0001)
              .lte('lat', latitude + 0.0001)
              .gte('lng', longitude - 0.0001)
              .lte('lng', longitude + 0.0001)
              .limit(1)
              .maybeSingle();

            if (nearby && (nearby as any).address) {
              const addr = (nearby as any).address;
              await supabase.from('locations').update({ address: addr }).eq('user_id', user_id);
              return;
            }

            const response = await axios.get(
              `https://nominatim.openstreetmap.org/reverse?format=json&lat=${latitude}&lon=${longitude}&zoom=18&addressdetails=1&accept-language=vi&email=AlanwalkerT2002@gmail.com`,
              { 
                headers: { 'User-Agent': `Location-Tracker-App-AI-Studio-${user_id}` },
                timeout: 5000
              }
            );
            
            if (response.status === 200) {
              const geoData = response.data;
              const addr = geoData.address || {};
              
              const house = addr.house_number || addr.building || addr.house_name || addr.office || addr.apartment || addr.flat || addr.street_number || addr.unit || addr.room;
              const street = addr.road || addr.pedestrian || addr.path || addr.street || addr.lane || addr.cycleway || addr.footway;
              const area = addr.suburb || addr.neighbourhood || addr.village || addr.quarter || addr.hamlet || addr.croft || addr.city_district;

              let address = "";
              if (house && street) {
                const formattedHouse = /^\d/.test(house) && !house.toLowerCase().includes('số') ? `Số ${house}` : house;
                const formattedStreet = !street.toLowerCase().includes('đường') && !street.toLowerCase().includes('phố') ? `Đường ${street}` : street;
                address = `${formattedHouse} ${formattedStreet}`;
              } else if (house) {
                address = /^\d/.test(house) && !house.toLowerCase().includes('số') ? `Số ${house}` : house;
              } else if (street) {
                address = !street.toLowerCase().includes('đường') && !street.toLowerCase().includes('phố') ? `Đường ${street}` : street;
              } else if (area) {
                address = area;
              }

              const fallback = geoData.display_name ? geoData.display_name.split(',').slice(0, 2).map((s: string) => s.trim()).join(', ') : "";
              if (!address) address = fallback || "";
              
              if (address && address !== clientAddress) {
                console.log(`[API Update] Address resolved: ${address}`);
                if (isUUID(user_id)) {
                  await supabase.from('locations').update({ address } as any).eq('user_id', user_id);
                }
                
                // Sync history
                await supabase.from('location_history')
                  .update({ address })
                  .eq('user_id', user_id)
                  .is('address', null)
                  .gte('lat', latitude - 0.0005)
                  .lte('lat', latitude + 0.0005);

                // NEW: Optimization - merge redundant consecutive addresses
                await cleanupRedundantHistory(user_id, address);
              }
            }
          } catch (e) {
            console.warn("[API Update] Geocoding background fail:", (e as Error).message);
          }
        })();
      }
    } catch (err: any) {
      console.error("[API Update] Final Catch Error:", err?.message || err);
      res.status(500).json({ error: "Internal server error", message: err?.message || String(err) });
    }
  });

  // Health check endpoint
  app.get("/api/health", (req, res) => {
    res.json({ status: "ok" });
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    // Production static serving
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://0.0.0.0:${PORT}`);
  });
}

startServer();
