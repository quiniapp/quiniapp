import { useState } from 'react';
import { Outlet, useNavigation } from 'react-router-dom';


import Footer from '../footer';
import Header from '../header';

import Aside from '@/components/aside';
import { SidebarProvider } from '@/components/ui/sidebar.tsx';
import { useMediaQuery } from '@/hooks/useMediaQuery.ts';
import { cn } from '@/lib/utils';

interface LayoutProps {
  classname?: string;
}

{
  /*  <Sidebar /> */
}
const Layout = ({ classname }: LayoutProps) => {
  const navigation = useNavigation();
  const isRouteLoading = navigation.state === 'loading';
  const [isOpen, setIsOpen] = useState(true);
  const toggleSidebar = () => {
    setIsOpen(!isOpen);
  };

  return (
    <SidebarProvider>
      <Aside isOpen={isOpen} />
      <main
        className={cn(
          classname,
          `flex flex-col gap-6 w-full transition-all duration-300 ease-in-out ${isOpen ? 'md:ml-64' : 'ml-0'}`
        )}
      >
        <div className="grid  grid-rows-[1fr_auto] 1440:grid-rows-[auto_1fr_auto] w-full overflow-hidden flex-1 border-[var(--isActive)]">
          { useMediaQuery('(min-width: 1440px)') &&   <Header setIsOpen={toggleSidebar} /> }

          <div className=" px-[24px] bg-[var(--primary-bg-content)]">
            {isRouteLoading && (
              <div className="absolute top-0 left-0 w-full h-full flex justify-center items-center bg-[rgba(0,0,0,0.1)] z-10">
                <p> cargando </p>
              </div>
            )}
            <Outlet />
          </div>
          <Footer />
        </div>
      </main>
    </SidebarProvider>
  );
};

export default Layout;
