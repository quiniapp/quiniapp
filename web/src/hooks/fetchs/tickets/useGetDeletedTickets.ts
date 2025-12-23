import { useQuery } from '@tanstack/react-query';
import { BACKEND_ROUTES } from '../../../../routes/routes';
import dayjs from 'dayjs';
import { apiClient } from '@/lib/apiClient';

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
      return await apiClient.get<number>(`${BACKEND_ROUTES.ticket.base}/deleted`, {
        params: {
          date: date || undefined,
          cashier_id: user_id || undefined,
        },
      });
    },
    enabled: !!date,
  });
};
