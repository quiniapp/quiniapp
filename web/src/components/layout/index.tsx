import { useEffect, useState } from 'react';
import { Outlet, useNavigation } from 'react-router-dom';

import Footer from '../footer';
import Header from '../header';

import Aside from '@/components/aside';
import { SidebarProvider } from '@/components/ui/sidebar.tsx';
import { useSessionStore } from '@/stores/sessionStore';
import { Flex, FlexCol } from '../flex';
import { cn } from '@/lib/utils';

const Layout = () => {
  const validateSession = useSessionStore((s) => s.validateSession);
  const { isAuth } = useSessionStore();
  const navigation = useNavigation();
  const isRouteLoading = navigation.state === 'loading';
  const [isOpen, setIsOpen] = useState(true);
  const toggleSidebar = () => {
    setIsOpen(!isOpen);
  };
  useEffect(() => {
    if (isAuth) validateSession();
  }, []);
  return (
    <SidebarProvider>
      <Flex className="h-screen w-screen overflow-hidden">
        <Aside isOpen={isOpen} />
        <FlexCol className={cn(`flex-1 relative transition-all duration-300 ease-in-out  ${isOpen ? '' : 'ml-0'}`)}>
          <Header setIsOpen={toggleSidebar} />
          <main className="flex flex-1 overflow-y-auto px-2 py-1 justify-center">
            {isRouteLoading && (
              <div className="absolute inset-0 flex justify-center items-center bg-[rgba(0,0,0,0.1)] z-10">
                <p> cargando </p>
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
