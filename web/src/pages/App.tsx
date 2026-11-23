// src/App.tsx
import { createBrowserRouter, RouterProvider } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import '../styles/App.css';
import { Toaster } from 'react-hot-toast';
import { ThemeProvider } from '../providers/theme-provider';
import { RoutesContent } from '../routes/route';
import { AuthProvider } from '@/providers/AuthProvider';
import { ConditionalProviders } from '@/providers/ConditionalProviders';
import { SpeedInsights } from '@vercel/speed-insights/react';
import { Analytics } from '@vercel/analytics/react';

const router = createBrowserRouter(RoutesContent);

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 5, // 5 minutos
      gcTime: 1000 * 60 * 30, // 30 minutos
      refetchOnWindowFocus: false,
      retry: 1,
    },
  },
});

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <ThemeProvider>
          <ConditionalProviders>
            <Toaster position="bottom-center" />
            <RouterProvider router={router} />
            {/* Se habilita con ENABLE_SPEED_INSIGHTS=true (ver vite.config.ts). */}
            {__ENABLE_SPEED_INSIGHTS__ && <SpeedInsights />}
            <Analytics />
          </ConditionalProviders>
        </ThemeProvider>
      </AuthProvider>
    </QueryClientProvider>
  );
}

export default App;
