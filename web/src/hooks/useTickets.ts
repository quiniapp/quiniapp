import { useQuery } from '@tanstack/react-query';
import { ROUTES } from '../../routes/routes';

const fetchTickets = async () => {
  const res = await fetch(ROUTES.ticket.base, {
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
  });
  if (!res.ok) throw new Error('Error fetching tickets');
  return res.json();
};

export const useTickets = () => useQuery({ queryKey: ['tickets'], queryFn: fetchTickets });
