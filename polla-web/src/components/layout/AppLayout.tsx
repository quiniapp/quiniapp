import { useMemo, useState } from 'react';
import { NavLink, Outlet, useMatches, useNavigate } from 'react-router-dom';
import {
  BarChart3,
  CalendarDays,
  CreditCard,
  FileText,
  ListOrdered,
  LogOut,
  Menu,
  PlusCircle,
  Settings,
  Ticket,
  Users,
  Building2,
} from 'lucide-react';
import { POLLA_USER_TYPE, POLLA_USER_TYPE_LABEL } from '@helper/polla/types/user.type';
import { useAuth } from '@/providers/AuthContext';
import type { RouteHandle } from '@/routes/route';
import { ROUTES } from '@/types/routes.type';
import { useOrganizations } from '@/hooks/fetchs/useCatalogs';
import { cn } from '@/lib/utils';
import { Button } from '../ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';

const ADMIN_AND_UP = [
  POLLA_USER_TYPE.OWNER,
  POLLA_USER_TYPE.CAPITALIST,
  POLLA_USER_TYPE.SUPERADMIN,
  POLLA_USER_TYPE.ADMIN,
];

const STAFF = [...ADMIN_AND_UP, POLLA_USER_TYPE.CASHIER];

interface NavItem {
  to: string;
  label: string;
  icon: typeof Ticket;
  roles?: POLLA_USER_TYPE[];
}

const NAV_ITEMS: NavItem[] = [
  { to: ROUTES.BETS, label: 'Jugadas', icon: Ticket },
  {
    to: ROUTES.MAKE_BET,
    label: 'Cargar jugada',
    icon: PlusCircle,
    roles: [POLLA_USER_TYPE.PLAYER, POLLA_USER_TYPE.CASHIER, ...ADMIN_AND_UP],
  },
  { to: ROUTES.SALES, label: 'Ventas del día', icon: BarChart3, roles: STAFF },
  { to: ROUTES.EDITIONS, label: 'Ediciones', icon: CalendarDays, roles: ADMIN_AND_UP },
  { to: ROUTES.RESULTS, label: 'Resultados', icon: FileText },
  { to: ROUTES.USERS, label: 'Usuarios', icon: Users, roles: STAFF },
  { to: ROUTES.CURRENT_ACCOUNT, label: 'Cuenta corriente', icon: CreditCard, roles: STAFF },
  { to: ROUTES.CATALOGS, label: 'Quinielas y turnos', icon: ListOrdered, roles: ADMIN_AND_UP },
  {
    to: ROUTES.ORGANIZATIONS,
    label: 'Organizaciones',
    icon: Building2,
    roles: [POLLA_USER_TYPE.OWNER],
  },
  { to: ROUTES.SETTINGS, label: 'Configuración', icon: Settings },
];

/** Solo el OWNER cambia de capitalist; el resto queda fijo a su organización. */
const OrganizationPicker = () => {
  const { activeOrganizationId, setActiveOrganizationId, role } = useAuth();
  const isOwner = role === POLLA_USER_TYPE.OWNER;
  const { data } = useOrganizations({}, isOwner);

  if (!isOwner) return null;

  return (
    <Select
      value={activeOrganizationId ?? 'all'}
      onValueChange={(value) => setActiveOrganizationId(value === 'all' ? null : value)}
    >
      <SelectTrigger className="w-full sm:w-[200px]">
        <SelectValue placeholder="Organización" />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="all">Todas las organizaciones</SelectItem>
        {data?.data.map((org) => (
          <SelectItem key={org.polla_organization_id} value={org.polla_organization_id}>
            {org.name}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
};

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
    () => NAV_ITEMS.filter((item) => !item.roles || (role && item.roles.includes(role))),
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

        {/* El selector de organización baja a su propia línea: con el nombre de
            un capitalist no entra al lado del título en 320px. */}
        <div className="w-full sm:w-auto">
          <OrganizationPicker />
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
