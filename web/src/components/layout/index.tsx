import { Outlet, useNavigation } from 'react-router-dom';
import { cn } from '@/lib/utils';

import Header from '../header';
import Footer from '../footer';
import Aside from '@/components/aside';
import { SidebarProvider } from '@/components/ui/sidebar.tsx';


interface LayoutProps {classname?: string;}

{
  /*  <Sidebar /> */
}
const Layout = ({ classname }: LayoutProps) => {


  const navigation = useNavigation();
  const isRouteLoading = navigation.state === 'loading';


  return (
    <SidebarProvider>
      <Aside />
      <main className={`${cn(classname)} flex gap-6 w-full ml-[260px] `}>
        <div className="grid grid-rows-[auto_1fr_auto] w-full overflow-hidden flex-1 border-[var(--isActive)] rounded-xl m-[24px]">
          <Header title="" />
          <div className=" bg-[var(--primary-bg-content)]">
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
