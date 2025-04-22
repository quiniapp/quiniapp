import {
  HomeIcon,
  TicketIcon,
  SettingsIcon,
  FileTextIcon,
  UserIcon,
  UsersIcon,
} from 'lucide-react';
import { ROUTES } from '@/types/routes.type';
import { MENU_ITEM } from '@/types/menu-item.tsx';

const MENU_ITEMS: MENU_ITEM[] = [
  {
    id: 'Home',
    name: 'Jugadas',
    route: ROUTES.HOME,
    icon: <HomeIcon size={20} />,
    children: [
      {
        id: 'PlayDetails',
        name: 'Realizar Jugadas',
        route: ROUTES.PLAY_DETAILS,
        icon: <FileTextIcon size={20} />,
      },
      {
        id: 'PlaysAndHits',
        name: 'Jugadas y Aciertos',
        route: ROUTES.PLAYS_AND_HITS,
        icon: <TicketIcon size={20} />,
      },
      {
        id: 'TerminalTicket',
        name: 'Revisar Ticket',
        route: ROUTES.TERMINAL_TICKET,
        icon: <TicketIcon size={20} />,
      },
    ],
  },

  {
    id: 'Results',
    name: 'Resultados',
    route: ROUTES.RESULTS,
    icon: <FileTextIcon size={20} />,
  },
  // Admin ve Qunielas
  {
    id: 'Quinielas',
    name: 'Qunielas',
    route: ROUTES.CLIENTS,
    icon: <UserIcon size={20} />,
    children: [
      {
        id: 'AgentCommission',
        name: 'Qunielas a jugarse',
        route: ROUTES.LOTTERIES,
        icon: <FileTextIcon size={20} />,
      },
      {
        id: 'Shifts',
        name: 'Turnos',
        route: ROUTES.SHIFTS,
        icon: <FileTextIcon size={20} />,
      },
    ],
  },

  {
    id: 'Users',
    name: 'Usuarios',
    route: ROUTES.USERS,
    icon: <UserIcon size={20} />,
    children: [
      {
        id: 'UsersLIst',
        name: 'Listado de Usuarios',
        route: ROUTES.USERS,
        icon: <UsersIcon size={20} />,
      },
      {
        id: 'Groups',
        name: 'Grupos',
        route: ROUTES.USERS,
        icon: <UsersIcon size={20} />,
      },
    ],
  },
  {
    id: 'CurrentAccount',
    name: 'Cuenta Corriente',
    route: ROUTES.CURRENT_ACCOUNT,
    icon: <FileTextIcon size={20} />,
  },

  {
    id: 'Reports',
    name: 'Reportes',
    route: ROUTES.REPORTS,
    icon: <FileTextIcon size={20} />,
  },
  {
    id: 'Settings',
    name: 'Configuración',
    route: ROUTES.SETTINGS,
    icon: <SettingsIcon size={20} />,
  },
];

export default MENU_ITEMS;
