import {
  HomeIcon,
  TicketIcon,
  SettingsIcon,
  FileTextIcon,
  UserIcon,
  UsersIcon,
  Building2,
} from 'lucide-react';

import { MENU_ITEM } from '@/types/menu-item.tsx';
import { ROUTES } from '@/types/routes.type';

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
        route: ROUTES.MAKE_PLAYS,
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
        route: ROUTES.UPCOMING_LOTTERIES,
        icon: <FileTextIcon size={20} />,
      },
      {
        id: 'Shifts',
        name: 'Turnos',
        route: ROUTES.SHIFTS,
        icon: <FileTextIcon size={20} />,
      },
      {
        id: 'Loteries',
        name: 'Loterias',
        route: ROUTES.LOTTERIES,
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
        route: ROUTES.USERS_LIST,
        icon: <UsersIcon size={20} />,
      },
      {
        id: 'Groups',
        name: 'Grupos',
        route: ROUTES.GROUPS,
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
    id: 'Organizations',
    name: 'Organizaciones',
    route: ROUTES.ORGANIZATIONS,
    icon: <Building2 size={20} />,
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
