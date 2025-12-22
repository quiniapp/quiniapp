import { lazy, Suspense } from 'react';
import { LoadingFallback } from '@/components/molecules/LoadingFallback';

// Eager imports (necesarios inmediatamente)
import LoginPage from '@/features/login';
import ProtectedRoute from '@/protected/protected-routes.tsx';
import { ROUTES } from '@/types/routes.type';

// Lazy imports (cargados bajo demanda)
const Layout = lazy(() => import('@/components/layout'));
const Index = lazy(() => import('@/pages').then(module => ({ default: module.Index })));
const ClientPage = lazy(() => import('@/pages/clients'));
const CurrentAccountPage = lazy(() => import('@/pages/current-account.tsx'));
const GroupsPage = lazy(() => import('@/pages/groups'));
const NotFound = lazy(() => import('@/pages/NotFound'));
const UserListPage = lazy(() => import('@/pages/user-list'));
const PlayDetailsPage = lazy(() => import('@/pages/MakePlays'));
const PlaysAndHitsPage = lazy(() => import('@/pages/plays-and-hits'));
const TerminalTicketPage = lazy(() => import('@/pages/terminal-ticket').then(module => ({ default: module.TerminalTicketPage })));
const ReportsPage = lazy(() => import('@/pages/reports'));
const ResultsPage = lazy(() => import('@/pages/results'));
const SettingsPage = lazy(() => import('@/pages/settings'));
const ShiftsPage = lazy(() => import('@/pages/shifts'));
const UpcomingLotteriesPage = lazy(() => import('@/pages/upcoming-lotteries.tsx'));
const UsersPage = lazy(() => import('@/pages/users'));
const NewUserPage = lazy(() => import('@/pages/new-user.tsx'));
const ResetPassword = lazy(() => import('@/pages/ResetPassword'));

// Helper para envolver componentes lazy con Suspense
function withSuspense(Component: React.LazyExoticComponent<any>) {
  return (
    <Suspense fallback={<LoadingFallback />}>
      <Component />
    </Suspense>
  );
}

export const RoutesContent = [
  {
    path: ROUTES.LOGIN,
    id: 'Login',
    element: <LoginPage />,
  },
  {
    path: '/',
    id: 'MainLayout',
    element: (
      <ProtectedRoute>
        <Suspense fallback={<LoadingFallback fullScreen />}>
          <Layout />
        </Suspense>
      </ProtectedRoute>
    ),
    children: [
      {
        path: ROUTES.HOME,
        id: 'Home',
        element: withSuspense(Index),
      },
      {
        path: ROUTES.MAKE_PLAYS,
        id: 'MakePlays',
        element: withSuspense(PlayDetailsPage),
      },
      {
        path: ROUTES.PLAYS_AND_HITS,
        id: 'PlaysAndHits',
        element: withSuspense(PlaysAndHitsPage),
      },
      {
        path: ROUTES.TERMINAL_TICKET,
        id: 'TerminalTicket',
        element: withSuspense(TerminalTicketPage),
      },
      {
        path: ROUTES.RESULTS,
        id: 'Results',
        element: withSuspense(ResultsPage),
      },
      {
        path: ROUTES.CLIENTS,
        id: 'Clients',
        element: withSuspense(ClientPage),
      },
      {
        path: ROUTES.CURRENT_ACCOUNT,
        id: 'CurrentAccount',
        element: withSuspense(CurrentAccountPage),
      },
      {
        path: ROUTES.SHIFTS,
        id: 'Shifts',
        element: withSuspense(ShiftsPage),
      },
      {
        path: ROUTES.USERS,
        id: 'Users',
        element: withSuspense(UsersPage),
      },
      {
        path: ROUTES.USERS_List,
        id: 'UsersList',
        element: withSuspense(UserListPage),
      },
      {
        path: ROUTES.REPORTS,
        id: 'Reports',
        element: withSuspense(ReportsPage),
      },
      {
        path: ROUTES.SETTINGS,
        id: 'Settings',
        element: withSuspense(SettingsPage),
      },
      {
        path: ROUTES.LOTTERIES,
        id: 'Lotteries',
        element: withSuspense(UpcomingLotteriesPage),
      },
      {
        path: ROUTES.GROUPS,
        id: 'Groups',
        element: withSuspense(GroupsPage),
      },
      {
        path: ROUTES.NEW_USER,
        id: 'New_User',
        element: withSuspense(NewUserPage),
      },
      {
        path: ROUTES.RESET_PASSWORD,
        id: 'Reset_Password',
        element: withSuspense(ResetPassword),
      }
    ],
  },
  {
    path: '*',
    id: 'NotFound',
    element: withSuspense(NotFound),
  },
];
