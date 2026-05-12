import express from "express";
import { createServer as createViteServer } from "vite";
import { createClient } from "@supabase/supabase-js";
import path from "path";
import dotenv from "dotenv";

// Load environment variables
dotenv.config();

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error("VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY is missing in environment variables.");
}

const supabase = createClient(supabaseUrl || '', supabaseServiceKey || '');

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
    
    // Extract core fields as requested by the user
    // id (Device Identifier) -> mapping to user_id
    // lat (Latitude) -> mapping to lat
    // lon (Longitude) -> mapping to lng
    // timestamp -> mapping to updated_at
    const { id, lat, lon, timestamp } = data;

    if (!id || !lat || !lon) {
      // Return 200 OK even if missing fields to satisfy Traccar client and prevent retry loops
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

      // Perform primary upsert into 'locations' table IMMEDIATELY for speed
      const { error: upsertError } = await supabase
        .from('locations')
        .upsert({
          user_id: id,
          lat: latitude,
          lng: longitude,
          updated_at: updatedAt,
        }, { onConflict: 'user_id' });

      if (upsertError) {
        console.error("[Traccar API] Supabase Upsert Error:", upsertError.message);
      }

      // Start background geocoding WITHOUT awaiting it to not block the response
      (async () => {
        try {
          // Optimization: Fetch current address to compare
          const { data: currentLoc } = await supabase
            .from('locations')
            .select('lat, lng, address')
            .eq('user_id', id)
            .maybeSingle();

          // If current address exists and movement is tiny (< 5m), skip geocoding
          if (currentLoc?.address && currentLoc.lat && currentLoc.lng) {
            const dLat = latitude - Number(currentLoc.lat);
            const dLng = longitude - Number(currentLoc.lng);
            const distSq = (dLat * dLat) + (dLng * dLng);
            if (distSq < 0.0000000002) { // approx 5m squared
              return;
            }
          }

          const response = await fetch(
            `https://nominatim.openstreetmap.org/reverse?format=json&lat=${latitude}&lon=${longitude}&zoom=18&addressdetails=1`,
            {
              headers: { 'User-Agent': 'Traccar-Optimizer-App' }
            }
          );
          if (response.ok) {
            const geoData = await response.json() as any;
            const addr = geoData.address || {};
            
            // Compose a short address: [number] [road]
            // Favor short components for brevity
            const shortAddress = [
              addr.house_number || addr.building,
              addr.road || addr.pedestrian || addr.suburb || addr.neighbourhood
            ].filter(Boolean).join(" ");

            const address = shortAddress || geoData.display_name || `${latitude.toFixed(4)}, ${longitude.toFixed(4)}`;
            
            // Update address in background
            await supabase
              .from('locations')
              .update({ address: address })
              .eq('user_id', id);
          }
        } catch (geoErr) {
          console.warn("[Traccar API] Background geocoding failed:", geoErr);
        }
      })();

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
      const { user_id, lat, lng } = req.body;
      if (!user_id || lat === undefined || lng === undefined) {
        return res.status(400).json({ error: "Missing parameters" });
      }

      // 1. Update coordinates immediately
      const { error: upsertError } = await supabase
        .from('locations')
        .upsert({
          user_id,
          lat,
          lng,
          updated_at: new Date().toISOString()
        }, { onConflict: 'user_id' });

      if (upsertError) throw upsertError;

      // 2. Respond immediately
      res.json({ status: "ok" });

      // 3. Background Geocoding
      (async () => {
        try {
          const response = await fetch(
            `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&zoom=18&addressdetails=1`,
            { headers: { 'User-Agent': 'Traccar-Optimizer-App' } }
          );
          if (response.ok) {
            const geoData = await response.json() as any;
            const addr = geoData.address || {};
            
            // Compose a short address: [number] [road]
            const shortAddress = [
              addr.house_number || addr.building,
              addr.road || addr.pedestrian || addr.suburb || addr.neighbourhood
            ].filter(Boolean).join(" ");

            const address = shortAddress || geoData.display_name || "";
            if (address) {
              await supabase.from('locations').update({ address }).eq('user_id', user_id);
            }
          }
        } catch (e) {
          console.warn("[API Update] Geocoding background fail:", e);
        }
      })();
    } catch (err) {
      console.error("[API Update] Error:", err);
      res.status(500).json({ error: "Internal server error" });
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
