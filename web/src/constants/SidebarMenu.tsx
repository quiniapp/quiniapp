import { HomeIcon, TicketIcon, SettingsIcon, FileTextIcon, UserIcon } from 'lucide-react';

const MENU_ITEMS = [
  { name: 'Jugadas', icon: <HomeIcon size={20} /> },
  { name: 'Detalles Jugadas', icon: <FileTextIcon size={20} /> },
  { name: 'Jugadas y Aciertos', icon: <TicketIcon size={20} /> },
  { name: 'Terminal Ticket', icon: <TicketIcon size={20} /> },
  { name: 'Resultados', icon: <FileTextIcon size={20} /> },
  { name: 'Clientes', icon: <UserIcon size={20} /> },
  { name: 'Comisión a agente', icon: <FileTextIcon size={20} /> },
  { name: 'Turnos', icon: <FileTextIcon size={20} /> },
  { name: 'Usuarios', icon: <UserIcon size={20} /> },
  { name: 'Reportes', icon: <FileTextIcon size={20} /> },
  { name: 'Configuración', icon: <SettingsIcon size={20} /> },
];

export default MENU_ITEMS;
