import { useContext, ReactNode, useMemo, useCallback, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import dayjs from 'dayjs';
import { TerminalTicketContext } from '../context/TerminalTIcketContext';

export type FilterType = 'all' | 'winner' | 'paid' | 'not_paid';

interface TerminalTicketProviderProps {
  children: ReactNode;
}

export const TerminalTicketProvider = ({ children }: TerminalTicketProviderProps) => {
  const [searchParams, setSearchParams] = useSearchParams();
  const[payTicket, setPayTicket] = useState<undefined|boolean>()
  // Get values from search params
  const date = searchParams.get('date') ?? undefined;
  const cashier_id = searchParams.get('cashier_id') ?? undefined;
  const group_id = searchParams.get('group_id') ?? undefined;
  const filterParam = searchParams.get('filter') ?? 'all';
  const ticket_number = searchParams.get('ticket_number') ?? undefined;

  // Normalize filter value
  const filter = (
    ['all', 'winner', 'paid', 'not_paid'].includes(filterParam) ? filterParam : 'all'
  ) as FilterType;

  // Computed values for TableTerminalTicket
  const winner = filter === 'winner' ? true : undefined;
  const paid = filter === 'paid' ? true : undefined;
  const not_paid = filter === 'not_paid' ? true : undefined;

  
  // Setters
  const setDate = useCallback(
    (newDate?: string) => {
      const params = new URLSearchParams(searchParams);
      if (newDate) {
        params.set('date', newDate);
      } else {
        params.set('date', dayjs().format('YYYY-MM-DD'));
      }
      setSearchParams(params);
    },
    [searchParams, setSearchParams]
  );

  const setCashierId = useCallback(
    (id?: string) => {
      const params = new URLSearchParams(searchParams);
      if (id) {
        params.set('cashier_id', id);
      } else {
        params.delete('cashier_id');
      }
      setSearchParams(params);
    },
    [searchParams, setSearchParams]
  );

  const setGroupId = useCallback(
    (id?: string) => {
      const params = new URLSearchParams(searchParams);
      if (id) {
        params.set('group_id', id);
      } else {
        params.delete('group_id');
      }
      params.delete('cashier_id');
      setSearchParams(params);
    },
    [searchParams, setSearchParams]
  );

  const toggleCashier = useCallback(
    (id: string) => {
      const params = new URLSearchParams(searchParams);
      if (cashier_id === id) {
        params.delete('cashier_id');
      } else {
        params.set('cashier_id', id);
      }
      setSearchParams(params);
    },
    [cashier_id, searchParams, setSearchParams]
  );

  const setFilter = useCallback(
    (newFilter: FilterType) => {
      const params = new URLSearchParams(searchParams);
      params.delete('ticket_number');
      if (newFilter === 'all') {
        params.delete('filter');
      } else {
        params.set('filter', newFilter);
      }
      setSearchParams(params);
    },
    [searchParams, setSearchParams]
  );

  const setTicketNumber = useCallback(
    (ticketNumber?: string) => {
      const params = new URLSearchParams(searchParams);
      if (ticketNumber) {
        params.set('ticket_number', ticketNumber.trim());
      } else {
        params.delete('ticket_number');
      }
      setSearchParams(params);
    },
    [searchParams, setSearchParams]
  );

  const toggleTicketNumber = useCallback(
    (ticketNumber: string) => {
      const params = new URLSearchParams(searchParams);
      if (ticket_number === ticketNumber) {
        params.delete('ticket_number');
      } else {
        params.set('ticket_number', ticketNumber);
      }
      setSearchParams(params);
    },
    [ticket_number, searchParams, setSearchParams]
  );

  const resetTicketNumber = useCallback(() => {
    const params = new URLSearchParams(searchParams);
    params.delete('ticket_number');
    setSearchParams(params, { replace: true });
  }, [searchParams, setSearchParams]);

  const resetAllFilters = useCallback(() => {
    setSearchParams({ date: dayjs().format('YYYY-MM-DD') });
  }, [setSearchParams]);

  const value = useMemo(
    () => ({
      // Values
      date,
      cashier_id,
      group_id,
      filter,
      ticket_number,
      winner,
      paid,
      not_paid,
      payTicket,

      // Setters
      setPayTicket,
      setDate,
      setCashierId,
      setGroupId,
      setFilter,
      setTicketNumber,
      toggleCashier,
      toggleTicketNumber,

      // Utilities
      resetTicketNumber,
      resetAllFilters,
    }),
    [
      date,
      cashier_id,
      group_id,
      filter,
      ticket_number,
      winner,
      paid,
      not_paid,
      payTicket,
      setDate,
      setCashierId,
      setGroupId,
      setFilter,
      setTicketNumber,
      toggleCashier,
      toggleTicketNumber,
      resetTicketNumber,
      resetAllFilters,
    ]
  );

  return <TerminalTicketContext.Provider value={value}>{children}</TerminalTicketContext.Provider>;
};

// Custom hook to use the context
export const useTerminalTicket = () => {
  const context = useContext(TerminalTicketContext);
  if (context === undefined) {
    throw new Error('useTerminalTicket must be used within a TerminalTicketProvider');
  }
  return context;
};
