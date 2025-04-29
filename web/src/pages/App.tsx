import { createBrowserRouter, RouterProvider } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import '../styles/App.css';
import { RoutesContent } from '../routes/route.tsx';
import { Toaster } from 'react-hot-toast';
import { ThemeProvider } from '../providers/theme-provider.tsx';
import { ModalProvider } from '@/providers/modal-provider.tsx';

const router = createBrowserRouter(RoutesContent);

function App() {
  const queryClient = new QueryClient();

  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider>
        <ModalProvider>
          <Toaster position="bottom-center" />
          <RouterProvider router={router} />
        </ModalProvider>
      </ThemeProvider>
    </QueryClientProvider>
  );
}

export default App;
