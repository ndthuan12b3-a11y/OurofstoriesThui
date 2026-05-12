import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import {defineConfig, loadEnv} from 'vite';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig(({mode}) => {
  const env = loadEnv(mode, '.', '');
  return {
    plugins: [
      react(), 
      tailwindcss(),
      VitePWA({
        registerType: 'prompt',
        injectRegister: 'auto',
        workbox: {
          globPatterns: ['**/*.{js,css,html,ico,png,svg,woff2}'],
          runtimeCaching: [
            {
              urlPattern: /^https:\/\/images\.unsplash\.com\/.*/i,
              handler: 'CacheFirst',
              options: {
                cacheName: 'unsplash-images',
                expiration: {
                  maxEntries: 50,
                  maxAgeSeconds: 60 * 60 * 24 * 30, // 30 Days
                },
                cacheableResponse: {
                  statuses: [0, 200],
                },
              },
            },
            {
              urlPattern: /^https:\/\/.*\.supabase\.co\/.*/i,
              handler: 'NetworkFirst',
              options: {
                cacheName: 'supabase-data',
              },
            },
          ],
        },
        includeAssets: ['favicon.ico', 'apple-touch-icon.png', 'mask-icon.svg', 'icon-192.svg', 'icon-512.svg', 'icon-192.png', 'icon-512.png'],
        manifest: {
          id: '/',
          name: 'Thúi House',
          short_name: 'ThúiHouse',
          description: 'Hành trình kỷ niệm tình yêu của chúng mình',
          theme_color: '#ff4d6d',
          background_color: '#ffffff',
          display: 'standalone',
          orientation: 'portrait',
          scope: '/',
          start_url: '/',
          icons: [
            {
              src: '/icon-192.svg',
              sizes: '192x192',
              type: 'image/svg+xml',
              purpose: 'maskable'
            },
            {
              src: '/icon-192.png',
              sizes: '192x192',
              type: 'image/png',
              purpose: 'any'
            },
            {
              src: '/icon-512.svg',
              sizes: '512x512',
              type: 'image/svg+xml',
              purpose: 'maskable'
            },
            {
              src: '/icon-512.png',
              sizes: '512x512',
              type: 'image/png',
              purpose: 'any'
            }
          ]
        }
      })
    ],
    define: {
      global: 'globalThis',
      'process.env.GEMINI_API_KEY': JSON.stringify(env.GEMINI_API_KEY),
      'process.env.GOOGLE_MAP_API_KEY': JSON.stringify(env.VITE_GOOGLE_MAP_API_KEY || ''),
      'process.env.GOOGLE_MAPS_PLATFORM_KEY': JSON.stringify(env.GOOGLE_MAPS_PLATFORM_KEY || env.VITE_GOOGLE_MAPS_PLATFORM_KEY || ''),
    },
    resolve: {
      alias: {
        'formdata-polyfill': path.resolve(__dirname, 'src/lib/empty.ts'),
        'node-fetch': path.resolve(__dirname, 'src/lib/fetch-shim.ts'),
        '@': path.resolve(__dirname, '.'),
      },
    },
    optimizeDeps: {
      include: ['p-retry'],
      exclude: ['formdata-polyfill', 'node-fetch', '@google/genai', '@supabase/supabase-js']
    },
    server: {
      // HMR is disabled in AI Studio via DISABLE_HMR env var.
      // Do not modifyâfile watching is disabled to prevent flickering during agent edits.
      hmr: process.env.DISABLE_HMR !== 'true',
    },
  };
});
