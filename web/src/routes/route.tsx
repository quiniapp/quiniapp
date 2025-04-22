import { Index } from '@/pages';
import NotFound from '@/pages/NotFound';

// @Page
import PlayDetailsPage from '@/pages/play-details';
import PlaysAndHitsPage from '@/pages/plays-and-hits';
import ShiftsPage from '@/pages/shifts';
import { TerminalTicketPage } from '@/pages/terminal-ticket';
import ResultsPage from '@/pages/results';
import ClientPage from '@/pages/clients';
import UsersPage from '@/pages/users';

// @Types
import { ROUTES } from '@/types/routes.type';
import ReportsPage from '@/pages/reports';
import SettingsPage from '@/pages/settings';
import LoginPage from '@/features/login';
import PlaysPage from '@/pages/plays.tsx';
import Layout from '@/components/layout';
import UpcomingLotteriesPage from '@/pages/upcoming-lotteries.tsx';
import CurrentAccountPage from '@/pages/current-account.tsx';

export const RoutesContent = [
  {
    path: ROUTES.LOGIN,
    id: 'Login',
    element: <LoginPage />,
  },
  {
    path: '/',
    id: 'MainLayout',
    element: <Layout />,
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
    ],
  },
  {
    path: '*',
    id: 'NotFound',
    element: <NotFound />,
  },
];
