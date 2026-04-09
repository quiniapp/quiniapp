import { createRoot } from 'react-dom/client';

import './styles/index.css';
import App from './pages/App.tsx';

// Reload once when a dynamic import fails due to stale chunk hashes after a new deploy.
window.addEventListener('vite:preloadError', () => {
  if (!sessionStorage.getItem('chunk-reload')) {
    sessionStorage.setItem('chunk-reload', '1');
    window.location.reload();
  }
});

createRoot(document.getElementById('root')!).render(<App />);
