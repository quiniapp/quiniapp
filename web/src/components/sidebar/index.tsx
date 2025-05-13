import { UserIcon } from 'lucide-react';

import SidebarItem from '@/components/sidebar/sidebar-item.tsx';
import MENU_ITEMS from '@/constants/SidebarMenu';

const Sidebar = () => {
  return (
    <aside className="max-w-[300px] flex-1 bg-[var(--primary-bg-content)] text-white flex flex-col h-screen border-r-2 ">
      <div className="p-4 border-b border-gray-700 flex items-center">
        <div className="text-red-500 mr-2">
          <span className="text-xl font-bold">✗</span>
        </div>
        <h1 className="text-lg font-semibold">Quini App</h1>
      </div>

      <div className="flex-1 overflow-auto">
        {MENU_ITEMS.map((item) => (
          <SidebarItem key={item.id} data={item} />
        ))}
      </div>

      <div className="p-4 border-t border-gray-700 flex items-center">
        <div className="w-8 h-8 rounded-full bg-gray-300 flex items-center justify-center overflow-hidden mr-3">
          <UserIcon size={20} className="text-gray-700" />
        </div>
        <div>
          <div className="text-sm font-semibold text-muted">Administrador</div>
          <div className="text-xs text-gray-400">(usuario 1)</div>
        </div>
      </div>
    </aside>
  );
};

export default Sidebar;
