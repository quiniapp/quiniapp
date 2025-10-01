import { createRoot } from 'react-dom/client';

import './styles/index.css';
import App from './pages/App.tsx';
import { injectSpeedInsights } from '@vercel/speed-insights';
 
injectSpeedInsights();

createRoot(document.getElementById('root')!).render(<App />);
