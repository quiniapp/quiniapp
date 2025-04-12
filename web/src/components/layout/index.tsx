import { Outlet } from 'react-router-dom';
import { cn } from '@/lib/utils';
import Sidebar from '../sidebar';
import Header from '../header';
import Footer from '../footer';

interface LayoutProps {
  classname?: string;
}

const Layout = ({ classname }: LayoutProps) => {
  return (
    <main className={`${cn(classname)} flex gap-6 `}>
      <Sidebar />
      <div className="grid grid-rows-[auto_1fr_auto] w-full overflow-hidden flex-1 border-[var(--isActive)] rounded-xl m-[24px]">
        <Header title="General Liquidaciones" />
        <div className="px-4 bg-[var(--primary-bg-content)]">
          <Outlet />
        </div>
        <Footer />
      </div>
    </main>
  );
};

export default Layout;
