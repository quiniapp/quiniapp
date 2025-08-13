import { createBrowserRouter, RouterProvider } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

import '../styles/App.css';
import { Toaster } from 'react-hot-toast';

import { ThemeProvider } from '../providers/theme-provider';
import { RoutesContent } from '../routes/route';

import { ModalProvider } from '@/providers/modal-provider';
import { ClockProvider } from '@/providers/ClockProvider';

const router = createBrowserRouter(RoutesContent);

function App() {
  const queryClient = new QueryClient();

  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider>
        <ClockProvider>
          <ModalProvider>
            <Toaster position="bottom-center" />
            <RouterProvider router={router} />
          </ModalProvider>
        </ClockProvider>
      </ThemeProvider>
    </QueryClientProvider>
  );
}

export default App;
