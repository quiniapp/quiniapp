import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import { applyTheme, readCachedTheme } from './lib/theme';
import './styles/index.css';

// Se pinta con el último tema usado hasta que /auth/validate traiga el del usuario.
applyTheme(readCachedTheme());

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>
);
