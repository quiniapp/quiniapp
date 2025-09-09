import { useQuery } from '@tanstack/react-query';
import { ROUTES } from '../../../../routes/routes';
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
      const res = await fetch(
        `${ROUTES.ticket.base}/deleted?date=${normalizedDate}&cashier_id=${user_id}`,
        { headers: { 'Content-Type': 'application/json' }, credentials: 'include' }
      );
      if (!res.ok) throw new Error('Error fetching tickets');
      const { data } = await res.json();
      return data.ticket;
    },
    enabled: !!user_id,
  });
};
