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

      // Perform upsert into 'locations' table
      // We use the service role key (initialized above) to bypass RLS and ensure reliability
      const { error } = await supabase
        .from('locations')
        .upsert({
          user_id: id,
          lat: latitude,
          lng: longitude,
          updated_at: updatedAt
        }, { onConflict: 'user_id' });

      if (error) {
        console.error("[Traccar API] Supabase Error:", error.message);
        return res.status(500).send("Database error");
      }

      // Traccar Client expects a plain text "OK" response
      res.status(200).send("OK");
    } catch (err) {
      console.error("[Traccar API] Critical error:", err);
      res.status(500).send("Internal server error");
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
