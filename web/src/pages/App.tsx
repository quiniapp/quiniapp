// src/App.tsx
import { createBrowserRouter, RouterProvider } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import '../styles/App.css';
import { Toaster } from 'react-hot-toast';
import { ThemeProvider } from '../providers/theme-provider';
import { RoutesContent } from '../routes/route';
import { AuthProvider } from '@/providers/AuthProvider';
import { ConditionalProviders } from '@/providers/ConditionalProviders';

const router = createBrowserRouter(RoutesContent);
export const queryClient = new QueryClient();

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <ThemeProvider>
          <ConditionalProviders>
            <Toaster position="bottom-center" />
            <RouterProvider router={router} />
          </ConditionalProviders>
        </ThemeProvider>
      </AuthProvider>
    </QueryClientProvider>
  );
}

export default App;
