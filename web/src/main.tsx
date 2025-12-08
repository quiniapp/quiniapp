import { createRoot } from 'react-dom/client';

import './styles/index.css';
import App from './pages/App.tsx';
import { injectSpeedInsights } from '@vercel/speed-insights';
 import { inject } from "@vercel/analytics"

injectSpeedInsights();
inject()

createRoot(document.getElementById('root')!).render(<App />);
