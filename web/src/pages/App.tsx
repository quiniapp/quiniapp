import { BrowserRouter, useRoutes } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import '../styles/App.css';
import { RoutesContent } from '../routes/route.tsx';
import { Toaster } from 'react-hot-toast';
import { ThemeProvider } from '../providers/theme-provider.tsx';

const AppRoutes = () => {
  return useRoutes(RoutesContent);
};

function App() {
  const queryClient = new QueryClient();

  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider>
        <Toaster position="bottom-center" />
        <BrowserRouter>
          <AppRoutes />
        </BrowserRouter>
      </ThemeProvider>
    </QueryClientProvider>
  );
}

export default App;
