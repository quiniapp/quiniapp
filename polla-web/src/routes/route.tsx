import { lazy, ReactNode, Suspense } from 'react';
import { Navigate, RouteObject } from 'react-router-dom';
import { POLLA_PAGE_ROLES, PollaPage } from '@helper/polla/config/access.config';
import { AppLayout } from '@/components/layout/AppLayout';
import { HomeRedirect, ProtectedRoute, RoleRoute } from '@/protected/ProtectedRoute';
import { ROUTES } from '@/types/routes.type';
import LoginPage from '@/features/login';

const BetsPage = lazy(() => import('@/features/bets'));
const MakeBetPage = lazy(() => import('@/features/make-bet'));
const ManageBetsPage = lazy(() => import('@/features/manage-bets'));
const EditionsPage = lazy(() => import('@/features/editions'));
const ResultsPage = lazy(() => import('@/features/results'));
const UsersPage = lazy(() => import('@/features/users'));
const CatalogsPage = lazy(() => import('@/features/catalogs'));
const OrganizationsPage = lazy(() => import('@/features/organizations'));
const GroupsPage = lazy(() => import('@/features/groups'));
const CheckTicketPage = lazy(() => import('@/features/check-ticket'));
const CurrentAccountPage = lazy(() => import('@/features/current-account'));
const ChangePasswordPage = lazy(() => import('@/features/change-password'));
const SettingsPage = lazy(() => import('@/features/settings'));
const SalesPage = lazy(() => import('@/features/sales'));

const withSuspense = (node: ReactNode) => (
  <Suspense fallback={<div className="p-6 text-muted-foreground">Cargando…</div>}>{node}</Suspense>
);

/**
 * Cada pantalla, con los roles de la matriz de acceso (`POLLA_PAGE_ROLES`):
 * la misma que usan el menú y la API. Entrar por URL a una que no le toca
 * lleva al inicio del rol.
 */
const guarded = (page: PollaPage, node: ReactNode) =>
  withSuspense(<RoleRoute allow={POLLA_PAGE_ROLES[page]}>{node}</RoleRoute>);

/**
 * El título de cada sección viaja en el `handle` de la ruta y lo pinta el
 * header (`AppLayout`), así ninguna pantalla lo repite en su contenido.
 */
export interface RouteHandle {
  title: string;
}

export const RoutesContent: RouteObject[] = [
  { path: ROUTES.LOGIN, element: <LoginPage /> },
  {
    path: '/',
    element: (
      <ProtectedRoute>
        <AppLayout />
      </ProtectedRoute>
    ),
    children: [
      // Jugadas, o Cargar jugada para el Súper.
      { index: true, element: <HomeRedirect /> },
      {
        path: ROUTES.BETS,
        element: guarded('BETS', <BetsPage />),
        handle: { title: 'Jugadas' } satisfies RouteHandle,
      },
      {
        // Las jugadas propias son una pestaña de Jugadas.
        path: ROUTES.MY_BETS,
        element: <Navigate to={`${ROUTES.BETS}?mine=1`} replace />,
      },
      {
        path: ROUTES.MAKE_BET,
        element: guarded('MAKE_BET', <MakeBetPage />),
        handle: { title: 'Cargar jugada' } satisfies RouteHandle,
      },
      {
        // Jugadas es de solo lectura para todos; acá cada rol administra lo
        // suyo (el pasador, lo suyo y de sus jugadores; el admin, su grupo;
        // el Súper, toda la organización).
        path: ROUTES.MANAGE_BETS,
        element: guarded('MANAGE_BETS', <ManageBetsPage />),
        handle: { title: 'Administrar jugadas' } satisfies RouteHandle,
      },
      {
        // Todos menos el jugador y el Súper, dentro de la propia organización.
        path: ROUTES.CHECK_TICKET,
        element: guarded('CHECK_TICKET', <CheckTicketPage />),
        handle: { title: 'Revisar ticket' } satisfies RouteHandle,
      },
      {
        path: ROUTES.SALES,
        element: guarded('SALES', <SalesPage />),
        handle: { title: 'Ventas del día' } satisfies RouteHandle,
      },
      {
        path: ROUTES.EDITIONS,
        element: guarded('EDITIONS', <EditionsPage />),
        handle: { title: 'Ediciones' } satisfies RouteHandle,
      },
      {
        // Todos menos el Súper (como en QuiniApp); solo superadmin+ carga y procesa.
        path: ROUTES.RESULTS,
        element: guarded('RESULTS', <ResultsPage />),
        handle: { title: 'Resultados' } satisfies RouteHandle,
      },
      {
        path: ROUTES.USERS,
        element: guarded('USERS', <UsersPage />),
        handle: { title: 'Usuarios' } satisfies RouteHandle,
      },
      {
        // Dueño, capitalista y superadmin; el pasador ve la suya. El admin no
        // tiene acceso (la API tampoco se lo da).
        path: ROUTES.CURRENT_ACCOUNT,
        element: guarded('CURRENT_ACCOUNT', <CurrentAccountPage />),
        handle: { title: 'Cuenta corriente' } satisfies RouteHandle,
      },
      {
        path: ROUTES.CATALOGS,
        element: guarded('CATALOGS', <CatalogsPage />),
        handle: { title: 'Quinielas y turnos' } satisfies RouteHandle,
      },
      {
        path: ROUTES.ORGANIZATIONS,
        element: guarded('ORGANIZATIONS', <OrganizationsPage />),
        handle: { title: 'Organizaciones' } satisfies RouteHandle,
      },
      {
        path: ROUTES.GROUPS,
        element: guarded('GROUPS', <GroupsPage />),
        handle: { title: 'Grupos' } satisfies RouteHandle,
      },
      {
        path: ROUTES.SETTINGS,
        element: withSuspense(<SettingsPage />),
        handle: { title: 'Configuración' } satisfies RouteHandle,
      },
      {
        // Solo para la contraseña inicial del OWNER del seed: el resto no se
        // cambia la contraseña (la pone un superior).
        path: ROUTES.CHANGE_PASSWORD,
        element: withSuspense(<ChangePasswordPage />),
        handle: { title: 'Cambiar contraseña' } satisfies RouteHandle,
      },
    ],
  },
  { path: '*', element: <Navigate to="/" replace /> },
];
