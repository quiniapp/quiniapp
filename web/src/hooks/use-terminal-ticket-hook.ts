import { useState } from 'react';
import { useTickets } from '@/hooks/useTickets.ts';
import { useDeleteTicket } from '@/hooks/useDeleteTicket.ts';
import { toast } from 'react-hot-toast';


type TicketFilter = 'all' | 'winner' | 'paid' | 'not_paid';



const useTerminalTicketHook = () => {
  const { data } = useTickets();
  const [ticketNumberFilter, setTicketNumberFilter] = useState('');
  const [selectedTicket, setSelectedTicket] = useState<any | null>(null);
  const [selectedBets, setSelectedBets] = useState<any[]>([]);
  const [winningBets, setWinningBets] = useState<any[]>([]);
  const [filteredTicketSource, setFilteredTicketSource] = useState<TicketFilter>('all');

  const { mutate: deleteTicket, isPending } = useDeleteTicket();

  const handleDeleteTicket = () => {
    if (!selectedTicket || !selectedTicket.ticket_id) {
      toast.error('No hay ticket seleccionado');
      return;
    }

    deleteTicket(selectedTicket.ticket_id, {
      onSuccess: () => {
        toast.success('Ticket eliminado correctamente');
        handleResetFilters();
      },
      onError: () => {
        toast.error('Error al eliminar el ticket');
      },
    });
  };


  const handleTicketClick = (ticket: any) => {
    setSelectedTicket(ticket);
    setSelectedBets(ticket.bets);
    setWinningBets(ticket.bets.filter((b: any) => b.winner));
  };


  const handleSearchByTicketNumber = (number: string) => {
    setTicketNumberFilter(number);
    setFilteredTicketSource('all');

    const tickets = data?.data?.ticket || [];
    const found = tickets.find((t: any) => t.ticket_number.includes(number));

    if (found) {
      setSelectedTicket(found);
      setSelectedBets(found.bets);
      setWinningBets(found.bets.filter((b: any) => b.winner));
    } else {
      setSelectedTicket(null);
      setSelectedBets([]);
      setWinningBets([]);
    }
  };


  const handleResetFilters = () => {
    setTicketNumberFilter('');
    setFilteredTicketSource('all');
    setSelectedTicket(null);
    setSelectedBets([]);
    setWinningBets([]);
  };



  const tickets = data?.data?.ticket || [];
  const filteredTickets = tickets.filter((t: any) => {
    switch (filteredTicketSource) {
      case 'winner':
        return t.bets.some((b: any) => b.winner);
      case 'paid':
        return t.paid === true;
      case 'not_paid':
        return t.paid === false;
      default:
        return ticketNumberFilter
          ? t.ticket_number.includes(ticketNumberFilter)
          : true;
    }
  });

  const handleChangeFilter = (value: TicketFilter) => {
    setFilteredTicketSource(value);
    setTicketNumberFilter('');
    const filtered = tickets.filter((t: any) => {
      if (value === 'winner') return t.bets.some((b:any) => b.winner);
      if (value === 'paid') return t.paid === true;
      if (value === 'not_paid') return t.paid === false;
      return true;
    });

    if (filtered.length > 0) {
      const first = filtered[0];
      setSelectedBets(first.bets);
      setWinningBets(first.bets.filter((b: any) => b.winner));
    } else {
      setSelectedBets([]);
      setWinningBets([]);
    }
  };


  console.log('Eliminando ticket con ID:', selectedTicket?.ticket_id ?? 'Ninguno seleccionado');


  return {
    data,
    isPending,
    winningBets,
    selectedBets,
    selectedTicket,
    filteredTickets,
    handleTicketClick,
    handleDeleteTicket,
    handleResetFilters,
    handleChangeFilter,
    handleSearchByTicketNumber,
  }
}

export default useTerminalTicketHook