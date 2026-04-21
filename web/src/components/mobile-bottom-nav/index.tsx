import { FileTextIcon, TicketIcon, MenuIcon, SearchIcon } from 'lucide-react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useSidebar } from '@/components/ui/sidebar';
import { ROUTES } from '@/types/routes.type';
import { cn } from '@/lib/utils';

const NAV_ITEMS = [
  { label: 'Jugadas', route: ROUTES.MAKE_PLAYS, icon: FileTextIcon },
  { label: 'Aciertos', route: ROUTES.PLAYS_AND_HITS, icon: TicketIcon },
  { label: 'Ticket', route: ROUTES.TERMINAL_TICKET, icon: SearchIcon },
  { label: 'Resultados', route: ROUTES.RESULTS, icon: FileTextIcon },
] as const;

const MobileBottomNav = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { toggleSidebar } = useSidebar();

  return (
    <div className="md:hidden bg-card border-t border-border pb-[env(safe-area-inset-bottom)]">
      <div className="flex items-stretch h-14">
        {NAV_ITEMS.map(({ label, route, icon: Icon }) => {
          const isActive = location.pathname === route;
          return (
            <button
              key={route}
              onClick={() => navigate(route)}
              className={cn(
                'flex flex-col items-center justify-center flex-1 gap-0.5 text-xs transition-colors',
                isActive
                  ? 'text-primary border-t-2 border-primary -mt-px'
                  : 'text-muted-foreground hover:text-foreground'
              )}
            >
              <Icon className="w-5 h-5" />
              <span>{label}</span>
            </button>
          );
        })}
        <button
          onClick={toggleSidebar}
          className="flex flex-col items-center justify-center flex-1 gap-0.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
        >
          <MenuIcon className="w-5 h-5" />
          <span>Más</span>
        </button>
      </div>
    </div>
  );
};

export default MobileBottomNav;
