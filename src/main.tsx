import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import { MusicProvider } from './lib/MusicContext';
import App from './App.tsx';
import './index.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <MusicProvider>
      <App />
    </MusicProvider>
  </StrictMode>,
);
