import { useQuery } from '@tanstack/react-query';
import { ROUTES } from '../../routes/routes';
import dayjs from 'dayjs';

const fetchTickets = async () => {
  const date = dayjs().format('YYYY-MM-DD')
  const res = await fetch(`${ROUTES.ticket.base}?date=${date}`, {
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
  });
  if (!res.ok) throw new Error('Error fetching tickets');
  return res.json();
};

export const useTickets = () => useQuery({ queryKey: ['tickets'], queryFn: fetchTickets });
