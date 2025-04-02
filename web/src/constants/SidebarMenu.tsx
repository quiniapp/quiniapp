import { HomeIcon, TicketIcon, SettingsIcon, FileTextIcon, UserIcon } from 'lucide-react';
import { ROUTES } from '@/types/routes.type';

const MENU_ITEMS = [
  {
    id: 'Home',
    name: 'Jugadas',
    route: ROUTES.HOME,
    icon: <HomeIcon size={20} />,
  },
  {
    id: 'PlayDetails',
    name: 'Detalles Jugadas',
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
    name: 'Terminal Ticket',
    route: ROUTES.TERMINAL_TICKET,
    icon: <TicketIcon size={20} />,
  },
  {
    id: 'Results',
    name: 'Resultados',
    route: ROUTES.RESULTS,
    icon: <FileTextIcon size={20} />,
  },
  {
    id: 'Clients',
    name: 'Clientes',
    route: ROUTES.CLIENTS,
    icon: <UserIcon size={20} />,
  },
  {
    id: 'AgentCommission',
    name: 'Comisión a agente',
    route: ROUTES.AGENT_COMMISSION,
    icon: <FileTextIcon size={20} />,
  },
  {
    id: 'Shifts',
    name: 'Turnos',
    route: ROUTES.SHIFTS,
    icon: <FileTextIcon size={20} />,
  },
  {
    id: 'Users',
    name: 'Usuarios',
    route: ROUTES.USERS,
    icon: <UserIcon size={20} />,
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
