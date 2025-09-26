// src/components/layout/index.tsx
import { useCallback, useEffect, useState } from 'react';
import { Outlet, useNavigation } from 'react-router-dom';

import Footer from '../footer';
import Header from '../header';
import Aside from '@/components/aside';
import { SidebarProvider } from '@/components/ui/sidebar';
import { Flex, FlexCol } from '../flex';
import { cn } from '@/lib/utils';
import { useAuth } from '@/contexts/AuthContext';

const Layout = () => {
  const { isAuth, validate } = useAuth();            // ⬅️ viene del AuthProvider
  const navigation = useNavigation();
  const isRouteLoading = navigation.state === 'loading';

  const [isOpen, setIsOpen] = useState(true);
  const toggleSidebar = useCallback(() => setIsOpen((v) => !v), []);

  // Tocar/validar sesión al montar el layout si ya está autenticado
  useEffect(() => {
    if (isAuth) void validate();
  }, [isAuth, validate]);

  return (
    <SidebarProvider>
      <Flex className="h-screen w-screen overflow-hidden">
        <Aside isOpen={isOpen} />
        <FlexCol className={cn(
          'flex-1 relative transition-all duration-300 ease-in-out',
          isOpen ? '' : 'ml-0'
        )}>
          <Header setIsOpen={toggleSidebar} />
          <main className="flex flex-1 overflow-y-auto px-2 py-1 justify-center">
            {isRouteLoading && (
              <div className="absolute inset-0 flex justify-center items-center bg-[rgba(0,0,0,0.1)] z-10">
                <p>cargando</p>
              </div>
            )}
            <Outlet />
          </main>
          <Footer />
        </FlexCol>
      </Flex>
    </SidebarProvider>
  );
};

export default Layout;
