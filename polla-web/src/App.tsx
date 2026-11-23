import { QueryCache, QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { RouterProvider, createBrowserRouter } from 'react-router-dom';
import { Toaster, toast } from 'react-hot-toast';
import { queryErrorMessage } from '@/lib/queryErrors';
import { Analytics } from '@vercel/analytics/react';
import { SpeedInsights } from '@vercel/speed-insights/react';
import { AuthProvider } from '@/providers/AuthProvider';
import { RoutesContent } from '@/routes/route';

const queryClient = new QueryClient({
  // Toda consulta que falla (después del reintento) avisa con el motivo. El
  // id evita apilar el mismo aviso cuando fallan varias a la vez. Las
  // mutaciones avisan solas (`useApiMutation`).
  queryCache: new QueryCache({
    onError: (error) => {
      const message = queryErrorMessage(error);
      if (message) toast.error(message, { id: message });
    },
  }),
  defaultOptions: {
    queries: {
      staleTime: 60 * 1000,
      gcTime: 30 * 60 * 1000,
      refetchOnWindowFocus: false,
      retry: 1,
    },
  },
});

const router = createBrowserRouter(RoutesContent);

export const App = () => (
  <QueryClientProvider client={queryClient}>
    <AuthProvider>
      <Toaster position="top-right" />
      <RouterProvider router={router} />
      {/* Vercel Web Analytics: visitas y páginas, separadas de las de QuiniApp. */}
      <Analytics />
      {/* Vercel Speed Insights: Core Web Vitals de usuarios reales, por página.
          Se habilita con ENABLE_SPEED_INSIGHTS=true (ver vite.config.ts). */}
      {__ENABLE_SPEED_INSIGHTS__ && <SpeedInsights />}
    </AuthProvider>
  </QueryClientProvider>
);

export default App;
