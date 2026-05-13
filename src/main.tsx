import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import { MusicProvider } from './lib/MusicContext';
import App from './App.tsx';
import './index.css';

// Suppress benign Vite WebSocket errors and GoTrue session errors.
if (typeof window !== 'undefined') {
  window.addEventListener('unhandledrejection', (event) => {
    const msg = event.reason?.message || String(event.reason) || '';
    if (
      msg.includes('WebSocket') || 
      msg.includes('vite') ||
      msg.includes('Invalid Refresh Token') ||
      msg.includes('refresh_token_not_found') ||
      msg.includes('closed before the connection is established') ||
      msg.includes('closed without opened') ||
      msg.includes('connection failed')
    ) {
      event.preventDefault();
      console.warn('[System] Suppressing benign system or auth error:', msg);
    }
  });
  
  window.addEventListener('error', (event) => {
    const msg = event.message || '';
    if (
      msg.includes('WebSocket') || 
      msg.includes('vite') ||
      msg.includes('Invalid Refresh Token') ||
      msg.includes('refresh_token_not_found')
    ) {
      event.preventDefault();
      console.warn('[System] Suppressing benign system or auth error:', msg);
    }
  });
}

// Service Worker Registration
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js')
      .then(registration => {
        console.log('SW registered: ', registration);
      })
      .catch(registrationError => {
        console.log('SW registration failed: ', registrationError);
      });
  });
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <MusicProvider>
      <App />
    </MusicProvider>
  </StrictMode>,
);
