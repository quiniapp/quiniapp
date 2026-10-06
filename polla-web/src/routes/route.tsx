import { lazy, ReactNode, Suspense } from 'react';
import { Navigate, RouteObject } from 'react-router-dom';
import { POLLA_USER_TYPE } from '@helper/polla/types/user.type';
import { AppLayout } from '@/components/layout/AppLayout';
import { ProtectedRoute, RoleRoute } from '@/protected/ProtectedRoute';
import { ROUTES } from '@/types/routes.type';
import LoginPage from '@/features/login';

const BetsPage = lazy(() => import('@/features/bets'));
const MakeBetPage = lazy(() => import('@/features/make-bet'));
const EditionsPage = lazy(() => import('@/features/editions'));
const ResultsPage = lazy(() => import('@/features/results'));
const UsersPage = lazy(() => import('@/features/users'));
const CatalogsPage = lazy(() => import('@/features/catalogs'));
const OrganizationsPage = lazy(() => import('@/features/organizations'));
const CurrentAccountPage = lazy(() => import('@/features/current-account'));
const ChangePasswordPage = lazy(() => import('@/features/change-password'));
const SettingsPage = lazy(() => import('@/features/settings'));
const SalesPage = lazy(() => import('@/features/sales'));

const ADMIN_AND_UP = [
  POLLA_USER_TYPE.OWNER,
  POLLA_USER_TYPE.CAPITALIST,
  POLLA_USER_TYPE.SUPERADMIN,
  POLLA_USER_TYPE.ADMIN,
];

const STAFF = [...ADMIN_AND_UP, POLLA_USER_TYPE.CASHIER];

const withSuspense = (node: ReactNode) => (
  <Suspense fallback={<div className="p-6 text-muted-foreground">Cargando…</div>}>{node}</Suspense>
);

const guarded = (allow: POLLA_USER_TYPE[], node: ReactNode) =>
  withSuspense(<RoleRoute allow={allow}>{node}</RoleRoute>);

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
      { index: true, element: <Navigate to={ROUTES.BETS} replace /> },
      {
        path: ROUTES.BETS,
        element: withSuspense(<BetsPage />),
        handle: { title: 'Jugadas' } satisfies RouteHandle,
      },
      {
        // Las jugadas propias son una pestaña de Jugadas.
        path: ROUTES.MY_BETS,
        element: <Navigate to={`${ROUTES.BETS}?mine=1`} replace />,
      },
      {
        path: ROUTES.MAKE_BET,
        element: guarded([POLLA_USER_TYPE.PLAYER, ...STAFF], <MakeBetPage />),
        handle: { title: 'Cargar jugada' } satisfies RouteHandle,
      },
      {
        path: ROUTES.SALES,
        element: guarded(STAFF, <SalesPage />),
        handle: { title: 'Ventas del día' } satisfies RouteHandle,
      },
      {
        path: ROUTES.EDITIONS,
        element: guarded(ADMIN_AND_UP, <EditionsPage />),
        handle: { title: 'Ediciones' } satisfies RouteHandle,
      },
      {
        // Todos los ven (como en QuiniApp); solo ADMIN+ carga y procesa.
        path: ROUTES.RESULTS,
        element: withSuspense(<ResultsPage />),
        handle: { title: 'Resultados' } satisfies RouteHandle,
      },
      {
        path: ROUTES.USERS,
        element: guarded(STAFF, <UsersPage />),
        handle: { title: 'Usuarios' } satisfies RouteHandle,
      },
      {
        path: ROUTES.CURRENT_ACCOUNT,
        element: guarded(STAFF, <CurrentAccountPage />),
        handle: { title: 'Cuenta corriente' } satisfies RouteHandle,
      },
      {
        path: ROUTES.CATALOGS,
        element: guarded(ADMIN_AND_UP, <CatalogsPage />),
        handle: { title: 'Quinielas y turnos' } satisfies RouteHandle,
      },
      {
        path: ROUTES.ORGANIZATIONS,
        element: guarded([POLLA_USER_TYPE.OWNER], <OrganizationsPage />),
        handle: { title: 'Organizaciones' } satisfies RouteHandle,
      },
      {
        path: ROUTES.SETTINGS,
        element: withSuspense(<SettingsPage />),
        handle: { title: 'Configuración' } satisfies RouteHandle,
      },
      {
        path: ROUTES.CHANGE_PASSWORD,
        element: withSuspense(<ChangePasswordPage />),
        handle: { title: 'Cambiar contraseña' } satisfies RouteHandle,
      },
    ],
  },
  { path: '*', element: <Navigate to={ROUTES.BETS} replace /> },
];
