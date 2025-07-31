import Layout from '@/components/layout';
import LoginPage from '@/features/login';
import { Index } from '@/pages';
import ClientPage from '@/pages/clients';
import CurrentAccountPage from '@/pages/current-account.tsx';
import GroupsPage from '@/pages/groups';
import NotFound from '@/pages/NotFound';

// @Page
import UserListPage from '@/pages/user-list';
import PlayDetailsPage from '@/pages/play-details';
import PlaysAndHitsPage from '@/pages/plays-and-hits';
import { TerminalTicketPage } from '@/pages/terminal-ticket';

// @Types
import ProtectedRoute from '@/protected/protected-routes.tsx';
import { ROUTES } from '@/types/routes.type';
import PlaysPage from '@/pages/plays.tsx';
import ReportsPage from '@/pages/reports';
import ResultsPage from '@/pages/results';
import SettingsPage from '@/pages/settings';
import ShiftsPage from '@/pages/shifts';
import UpcomingLotteriesPage from '@/pages/upcoming-lotteries.tsx';
import UsersPage from '@/pages/users';
import NewUserPage from '@/pages/new-user.tsx';
import path from 'path';
import ResetPassword from '@/pages/ResetPassword';

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
        <Layout />
      </ProtectedRoute>
    ),
    children: [
      {
        path: ROUTES.HOME,
        id: 'Home',
        element: <Index />,
      },
      {
        path: ROUTES.PLAYS,
        id: 'Plays',
        element: <PlaysPage />,
      },
      {
        path: ROUTES.PLAY_DETAILS,
        id: 'PlayDetails',
        element: <PlayDetailsPage />,
      },
      {
        path: ROUTES.PLAYS_AND_HITS,
        id: 'PlaysAndHits',
        element: <PlaysAndHitsPage />,
      },
      {
        path: ROUTES.TERMINAL_TICKET,
        id: 'TerminalTicket',
        element: <TerminalTicketPage />,
      },
      {
        path: ROUTES.RESULTS,
        id: 'Results',
        element: <ResultsPage />,
      },
      {
        path: ROUTES.CLIENTS,
        id: 'Clients',
        element: <ClientPage />,
      },
      {
        path: ROUTES.CURRENT_ACCOUNT,
        id: 'CurrentAccount',
        element: <CurrentAccountPage />,
      },
      {
        path: ROUTES.SHIFTS,
        id: 'Shifts',
        element: <ShiftsPage />,
      },
      {
        path: ROUTES.USERS,
        id: 'Users',
        element: <UsersPage />,
      },
      {
        path: ROUTES.USERS_List,
        id: 'UsersList',
        element: <UserListPage />,
      },
      {
        path: ROUTES.REPORTS,
        id: 'Reports',
        element: <ReportsPage />,
      },
      {
        path: ROUTES.SETTINGS,
        id: 'Settings',
        element: <SettingsPage />,
      },
      {
        path: ROUTES.LOTTERIES,
        id: 'Lotteries',
        element: <UpcomingLotteriesPage />,
      },
      {
        path: ROUTES.GROUPS,
        id: 'Groups',
        element: <GroupsPage />,
      },
      {
        path: ROUTES.NEW_USER,
        id: 'New_User',
        element: <NewUserPage />,
      },
      {
        path: ROUTES.RESET_PASSWORD,
        id: 'Reset_Password',
        element: <ResetPassword />,
      }
    ],
  },
  {
    path: '*',
    id: 'NotFound',
    element: <NotFound />,
  },
];
