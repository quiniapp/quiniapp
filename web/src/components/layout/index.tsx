import React from 'react';
import { cn } from '@/lib/utils';
import Sidebar from '../sidebar';
import Header from '../header';
import Footer from '../footer';

interface LayoutProps {
  children: React.ReactNode;
  classname?: string;
}
const Layout = ({ children, classname }: LayoutProps) => {
  return (
    <main className={`${cn(classname)} `}>
      <Sidebar />
      <div className="grid grid-rows-[auto_1fr_auto]   w-full overflow-hidden border-4 border-[#33A7F3] rounded-xl m-4">
        <Header title="General Liquidaciones" />

        <div className="px-4 bg-[var(--primary-bg-content)]">{children}</div>
        <Footer />
      </div>
    </main>
  );
};

export default Layout;
