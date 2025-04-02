import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import './App.css';
import { RoutesContent } from './routes/route';
import { Toaster } from 'react-hot-toast';
import { ThemeProvider } from './providers/theme-provider';

function App() {
  const queryClient = new QueryClient();

  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider>
        <Toaster position="bottom-center" />
        <BrowserRouter>
          <Routes>
            {RoutesContent.map((route) => (
              <Route key={route.id} path={route.path} element={route.element} />
            ))}
          </Routes>
        </BrowserRouter>
      </ThemeProvider>
    </QueryClientProvider>
  );
}

export default App;
