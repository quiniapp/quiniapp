import { useQuery } from '@tanstack/react-query';
import { ROUTES } from '../../../../routes/routes';
import dayjs from 'dayjs';

interface FetchTicketsProps {
  date?: string;
  user_id?: string;
}

const fetchTickets = async ({ user_id, date }: FetchTicketsProps) => {
  const res = await fetch(
    `${ROUTES.ticket.base}${user_id ? `/user/${user_id}` : ''}?date=${date ? `${date}` : `${dayjs().format('YYYY-MM-DD')}`}`,
    {
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
    }
  );
  if (!res.ok) throw new Error('Error fetching tickets');
  const { data } = await res.json();

  return data.ticket;
};

export const useTickets = ({ user_id, date }: FetchTicketsProps) =>
  useQuery({
    queryKey: ['tickets', user_id, date],
    queryFn: () => fetchTickets({ user_id, date }),
  });
