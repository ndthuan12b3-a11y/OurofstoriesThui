import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import { MusicProvider } from './lib/MusicContext';
import App from './App.tsx';
import './index.css';

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
