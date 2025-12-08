import { createContext } from 'react';
import { FilterType } from '../provider/TerminalTicketProvider';

interface TerminalTicketContextValue {
  // Search params values
  date: string | undefined;
  cashier_id: string | undefined;
  filter: FilterType;
  ticket_number: string | undefined;

  // Computed values for TableTerminalTicket
  winner: boolean | undefined;
  paid: boolean | undefined;
  not_paid: boolean | undefined;
  ticketPaid: boolean | undefined;

  // Setters
  setTicketPaid: React.Dispatch<React.SetStateAction<boolean | undefined>>;
  setDate: (date?: string) => void;
  setCashierId: (id?: string) => void;
  setFilter: (filter: FilterType) => void;
  setTicketNumber: (ticketNumber?: string) => void;
  toggleCashier: (id: string) => void;
  toggleTicketNumber: (ticketNumber: string) => void;

  // Utilities
  resetTicketNumber: () => void;
  resetAllFilters: () => void;
}

export const TerminalTicketContext = createContext<TerminalTicketContextValue | undefined>(
  undefined
);
