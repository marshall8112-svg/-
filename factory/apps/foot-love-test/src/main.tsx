import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import { initAds } from './lib/ads';
import './styles.css';

initAds();

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
