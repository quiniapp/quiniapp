// src/components/layout/index.tsx
import { startTransition, useCallback, useState } from 'react';
import { Outlet, useNavigation } from 'react-router-dom';

import Footer from '../footer';
import Header from '../header';
import Aside from '@/components/aside';
import { SidebarProvider } from '@/components/ui/sidebar';
import { Flex, FlexCol } from '../flex';
import { cn } from '@/lib/utils';

const Layout = () => {
  const navigation = useNavigation();
  const isRouteLoading = navigation.state === 'loading';

  const [isOpen, setIsOpen] = useState(true);
  const toggleSidebar = useCallback(() => {
    startTransition(() => setIsOpen((v) => !v));
  }, []);

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
            className="flex flex-1 w-full max-w-full mx-auto min-h-0 min-w-0 overflow-y-auto overflow-x-hidden px-2 py-1 sm:px-2 xl:px-3 2xl:px-4 2xl:py-2  justify-center"
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
