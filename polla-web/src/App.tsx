import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { RouterProvider, createBrowserRouter } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import { Analytics } from '@vercel/analytics/react';
import { AuthProvider } from '@/providers/AuthProvider';
import { RoutesContent } from '@/routes/route';

const queryClient = new QueryClient({
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
    </AuthProvider>
  </QueryClientProvider>
);

export default App;
