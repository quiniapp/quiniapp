import { useLocation, useNavigate } from 'react-router-dom';
import MENU_ITEMS from '@/constants/SidebarMenu';
import { UserIcon } from 'lucide-react';

const Sidebar = () => {
  const location = useLocation();
  const navigate = useNavigate();

  const isRouteActive = (route: string) => {
    const current = location.pathname;
    return current === route || current.startsWith(route + '/');
  };

  return (
    <aside className="w-56 bg-background text-white flex flex-col h-screen">
      <div className="p-4 border-b border-gray-700 flex items-center">
        <div className="text-red-500 mr-2">
          <span className="text-xl font-bold">✗</span>
        </div>
        <h1 className="text-lg font-semibold">Quini App</h1>
      </div>

      <div className="flex-1 overflow-auto">
        {MENU_ITEMS.map((item) => (
          <div
            key={item.id}
            onClick={() => navigate(item.route)}
            className={`flex items-center p-3 text-sm hover:bg-gray-700 cursor-pointer ${
              isRouteActive(item.route) ? 'bg-red-900' : ''
            }`}
          >
            <span className="mr-3 text-gray-400">{item.icon}</span>
            <span className="text-muted">{item.name}</span>
          </div>
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
