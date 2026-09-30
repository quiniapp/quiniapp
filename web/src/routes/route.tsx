import { lazy, Suspense } from 'react';
import { Navigate } from 'react-router-dom';
import { LoadingFallback } from '@/components/molecules/LoadingFallback';

// Eager imports (necesarios inmediatamente)
import LoginPage from '@/features/login';
import ProtectedRoute from '@/protected/protected-routes.tsx';
import { ROUTES } from '@/types/routes.type';

// Prefetch chunks for returning users in parallel with validate()
if (sessionStorage.getItem('auth_hint') === '1') {
  void import('@/components/layout');
  void import('@/pages/MakePlays');
}

// Lazy imports (cargados bajo demanda)
const Layout = lazy(() => import('@/components/layout'));
const CurrentAccountPage = lazy(() => import('@/pages/current-account.tsx'));
const GroupsPage = lazy(() => import('@/pages/groups'));
const NotFound = lazy(() => import('@/pages/NotFound'));
const UserListPage = lazy(() => import('@/pages/user-list'));
const PlayDetailsPage = lazy(() => import('@/pages/MakePlays'));
const PlaysAndHitsPage = lazy(() => import('@/pages/plays-and-hits'));
const TerminalTicketPage = lazy(() =>
  import('@/pages/terminal-ticket').then((module) => ({ default: module.TerminalTicketPage }))
);
const ReportsPage = lazy(() => import('@/pages/reports'));
const ResultsPage = lazy(() => import('@/pages/results'));
const SettingsPage = lazy(() => import('@/pages/settings'));
const ShiftsPage = lazy(() => import('@/pages/shifts'));
const UpcomingLotteriesPage = lazy(() => import('@/pages/upcoming-lotteries.tsx'));
const UsersPage = lazy(() => import('@/pages/users'));
const NewUserPage = lazy(() => import('@/pages/new-user.tsx'));
const ResetPassword = lazy(() => import('@/pages/ResetPassword'));
const OrganizationsPage = lazy(() => import('@/pages/organizations'));
const LotteriesPage = lazy(() => import('@/pages/Lotteries'));

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
        element: <Navigate to={ROUTES.MAKE_PLAYS} replace />,
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
        path: ROUTES.CURRENT_ACCOUNT,
        id: 'CurrentAccount',
        element: withSuspense(CurrentAccountPage),
      },
      {
        path: ROUTES.SCHEDULES,
        id: 'Schedules',
        element: withSuspense(ShiftsPage),
      },
      {
        path: ROUTES.USERS,
        id: 'Users',
        element: withSuspense(UsersPage),
      },
      {
        path: ROUTES.USERS_LIST,
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
        path: ROUTES.UPCOMING_LOTTERIES,
        id: 'UpcomingLotteries',
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
      },
      {
        path: ROUTES.ORGANIZATIONS,
        id: 'Organizations',
        element: withSuspense(OrganizationsPage),
      },
      {
        path: ROUTES.LOTTERIES,
        id: 'Lotteries',
        element: withSuspense(LotteriesPage),
      },
    ],
  },
  {
    path: '*',
    id: 'NotFound',
    element: withSuspense(NotFound),
  },
];
