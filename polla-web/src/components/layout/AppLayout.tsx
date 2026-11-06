import { useMemo, useState } from 'react';
import { NavLink, Outlet, useMatches, useNavigate } from 'react-router-dom';
import {
  BarChart3,
  CalendarDays,
  ClipboardList,
  CreditCard,
  FileText,
  ListOrdered,
  LogOut,
  Menu,
  PlusCircle,
  ScanSearch,
  Settings,
  Ticket,
  Users,
  UsersRound,
  Building2,
} from 'lucide-react';
import { POLLA_USER_TYPE_LABEL } from '@helper/polla/types/user.type';
import { PollaPage, canSeePollaPage } from '@helper/polla/config/access.config';
import { useAuth } from '@/providers/AuthContext';
import type { RouteHandle } from '@/routes/route';
import { PAGE_PATH } from '@/routes/pages';
import { ROUTES } from '@/types/routes.type';
import { cn } from '@/lib/utils';
import { Button } from '../ui/button';

interface NavItem {
  page: PollaPage;
  label: string;
  icon: typeof Ticket;
}

/**
 * El menú, en orden. Quién ve cada ítem sale de la matriz de acceso
 * (`POLLA_PAGE_ROLES`, la misma que usan las rutas y la API): el Súper ve
 * solo Cargar jugada, Administrar jugadas y Configuración.
 */
const NAV_ITEMS: NavItem[] = [
  { page: 'MAKE_BET', label: 'Cargar jugada', icon: PlusCircle },
  { page: 'BETS', label: 'Jugadas', icon: Ticket },
  { page: 'MANAGE_BETS', label: 'Administrar jugadas', icon: ClipboardList },
  { page: 'CHECK_TICKET', label: 'Revisar ticket', icon: ScanSearch },
  { page: 'SALES', label: 'Ventas del día', icon: BarChart3 },
  // Ediciones, quinielas, turnos y grupos son de toda la organización.
  { page: 'EDITIONS', label: 'Ediciones', icon: CalendarDays },
  { page: 'RESULTS', label: 'Resultados', icon: FileText },
  { page: 'USERS', label: 'Usuarios', icon: Users },
  // El pasador ve solo la suya. El admin no tiene cuenta corriente.
  { page: 'CURRENT_ACCOUNT', label: 'Cuenta corriente', icon: CreditCard },
  { page: 'CATALOGS', label: 'Quinielas y turnos', icon: ListOrdered },
  { page: 'GROUPS', label: 'Grupos', icon: UsersRound },
  { page: 'ORGANIZATIONS', label: 'Organizaciones', icon: Building2 },
  { page: 'SETTINGS', label: 'Configuración', icon: Settings },
];

export const AppLayout = () => {
  const { user, role, logout } = useAuth();
  const navigate = useNavigate();
  const matches = useMatches();
  const [menuOpen, setMenuOpen] = useState(false);

  // La ruta más profunda que declare un título gana.
  const sectionTitle =
    [...matches]
      .reverse()
      .map((match) => (match.handle as RouteHandle | undefined)?.title)
      .find(Boolean) ?? '';

  const items = useMemo(
    () =>
      NAV_ITEMS.filter((item) => canSeePollaPage(role, item.page)).map((item) => ({
        ...item,
        to: PAGE_PATH[item.page],
      })),
    [role]
  );

  const handleLogout = async () => {
    await logout();
    navigate(ROUTES.LOGIN, { replace: true });
  };

  return (
    <div className="flex min-h-screen flex-col">
      <header className="sticky top-0 z-40 flex flex-wrap items-center gap-2 border-b bg-card px-3 py-2 sm:gap-3 sm:px-4 sm:py-3">
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="md:hidden"
          aria-label="Menú"
          onClick={() => setMenuOpen((open) => !open)}
        >
          <Menu />
        </Button>

        {/* El título sale del `handle` de la ruta: ninguna pantalla lo repite. */}
        <span className="hidden font-semibold tracking-wide text-muted-foreground sm:inline">
          POLLA
        </span>
        <h1 className="min-w-0 truncate font-semibold tracking-wide text-foreground">
          {sectionTitle}
        </h1>

        <div className="ml-auto flex items-center gap-2 sm:gap-3">
          {__COMMIT_DATE__ && (
            <span className="hidden text-xs text-muted-foreground sm:inline">
              v{__COMMIT_DATE__}
            </span>
          )}

          <div className="flex min-w-0 flex-col items-end leading-tight">
            <span className="max-w-[9rem] truncate text-sm font-medium text-foreground sm:max-w-none">
              {user?.name}
            </span>
            {role && (
              <span className="text-xs text-muted-foreground">{POLLA_USER_TYPE_LABEL[role]}</span>
            )}
          </div>

          <Button type="button" variant="outline" size="sm" onClick={handleLogout}>
            <LogOut />
            <span className="hidden sm:inline">Salir</span>
          </Button>
        </div>
      </header>

      <div className="flex min-w-0 flex-1">
        {/* En mobile el menú se abre encima con un backdrop; si empujara el
            contenido, en 320px no quedaría nada de ancho útil. */}
        {menuOpen && (
          <button
            type="button"
            aria-label="Cerrar menú"
            className="fixed inset-0 z-40 bg-black/60 md:hidden"
            onClick={() => setMenuOpen(false)}
          />
        )}

        <nav
          className={cn(
            'w-56 shrink-0 border-r bg-card p-3',
            'max-md:fixed max-md:inset-y-0 max-md:left-0 max-md:z-50 max-md:overflow-y-auto',
            menuOpen ? 'block' : 'hidden md:block'
          )}
        >
          {__COMMIT_DATE__ && (
            <p className="mb-2 px-3 text-xs text-muted-foreground sm:hidden">v{__COMMIT_DATE__}</p>
          )}
          <ul className="flex flex-col gap-1">
            {items.map(({ to, label, icon: Icon }) => (
              <li key={to}>
                <NavLink
                  to={to}
                  onClick={() => setMenuOpen(false)}
                  className={({ isActive }) =>
                    cn(
                      'flex items-center gap-2 rounded-md px-3 py-2 text-sm transition-colors',
                      isActive
                        ? 'bg-nav-active text-nav-active-foreground'
                        : 'text-foreground hover:bg-accent hover:text-accent-foreground'
                    )
                  }
                >
                  <Icon size={16} />
                  {label}
                </NavLink>
              </li>
            ))}
          </ul>
        </nav>

        <main className="min-w-0 flex-1 p-3 sm:p-4">
          <Outlet />
        </main>
      </div>
    </div>
  );
};
