import { Outlet } from 'react-router-dom';
import { cn } from '@/lib/utils';
//import Sidebar from '../sidebar';
import Header from '../header';
import Footer from '../footer';
import Aside from '@/components/aside';
import { SidebarProvider } from '@/components/ui/sidebar.tsx';

interface LayoutProps {
  classname?: string;
}

{
  /*  <Sidebar /> */
}
const Layout = ({ classname }: LayoutProps) => {
  return (
    <SidebarProvider>
      <Aside />
      <main className={`${cn(classname)} flex gap-6 w-full ml-[260px] `}>
        <div className="grid grid-rows-[auto_1fr_auto] w-full overflow-hidden flex-1 border-[var(--isActive)] rounded-xl m-[24px]">
          <Header title="General Liquidaciones" />
          <div className="px-4 bg-[var(--primary-bg-content)]">
            <Outlet />
          </div>
          <Footer />
        </div>
      </main>
    </SidebarProvider>
  );
};

export default Layout;
