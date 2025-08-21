import { useQuery } from '@tanstack/react-query';
import { ROUTES } from '../../../../routes/routes';
import dayjs from 'dayjs';

interface FetchTicketsProps {
  date?: string;
  user_id?: string;
}

const fetchTickets = async ({ user_id }: FetchTicketsProps) => {
  const date = dayjs().format('YYYY-MM-DD');
  const res = await fetch(
    `${ROUTES.ticket.base}${user_id ? `/user/${user_id}` : ''}?date=${date}`,
    {
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
    }
  );
  if (!res.ok) throw new Error('Error fetching tickets');
  const { data } = await res.json();
  console.log('fetch', data)
  return data.ticket;
};

export const useTickets = ({ user_id }: FetchTicketsProps) =>
  useQuery({ queryKey: ['tickets', user_id], queryFn: () => fetchTickets({ user_id }) });
