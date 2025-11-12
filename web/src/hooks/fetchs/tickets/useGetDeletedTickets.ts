import { useQuery } from '@tanstack/react-query';
import { BACKEND_ROUTES } from '../../../../routes/routes';
import dayjs from 'dayjs';

export const useGetDeletedTickets = ({
  user_id,
  date,
}: {
  date?: string | null;
  user_id: string | null;
}) => {
  const normalizedDate = date ?? dayjs().format('YYYY-MM-DD');

  return useQuery<number>({
    queryKey: ['deletdTickets', user_id, normalizedDate],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (date) params.append('date', date);
      if (user_id) params.append('cashier_id', user_id);
      const res = await fetch(`${BACKEND_ROUTES.ticket.base}/deleted?${params.toString()}`, {
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
      });
      if (!res.ok) throw new Error('Error fetching tickets');
      const { data } = await res.json();
      return data.ticket;
    },
    enabled: !!date
  });
};
