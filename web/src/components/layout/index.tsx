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
  const { isAuth, validate } = useAuth(); // ⬅️ viene del AuthProvider
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
      <Flex className="h-dvh w-full overflow-hidden">
        <Aside isOpen={isOpen} />
        <FlexCol
          className={cn(
            'flex-1 relative transition-all duration-300 ease-in-out min-w-0 min-h-0',
            isOpen ? '' : 'ml-0'
          )}
        >
          <Header setIsOpen={toggleSidebar} />

          <main
            className="flex flex-1 w-full max-w-full mx-auto min-h-0 min-w-0 overflow-y-auto overflow-x-hidden px-2 py-1 sm:px-4 sm:py-2 md:px-6 lg:px-8 justify-center"
            style={{
              scrollbarWidth: 'thin',
              scrollbarColor: '#666 transparent',
            }}
          >
            {isRouteLoading && (
              <div className="absolute inset-0 z-10 flex items-center justify-center">
                <p>cargando</p>
              </div>
            )}

            {/* 🔧 centra contenido y limita ancho */}
            <Outlet />
          </main>
          <Footer />
        </FlexCol>
      </Flex>
    </SidebarProvider>
  );
};

export default Layout;
