import { useQuery } from '@tanstack/react-query';
import dayjs from 'dayjs';
import { BACKEND_ROUTES } from '../../../../routes/routes';
import { apiClient } from '@/lib/apiClient';

interface UseTicketsParams {
  user_id?: string;
  date?: string;
  winner?: boolean;
  enabled?: boolean;
}

export const useGetTicketsNumber = ({
  user_id,
  date,
  winner,
  enabled = true,
}: UseTicketsParams) => {
  const normalizedDate = date ?? dayjs().format('YYYY-MM-DD');

  return useQuery<{ ticket_id: string; ticket_number: string }[]>({
    queryKey: ['get_ticket_number', user_id ?? null, normalizedDate, winner],
    enabled,
    queryFn: async () => {
      return await apiClient.get<{ ticket_id: string; ticket_number: string }[]>(
        BACKEND_ROUTES.ticket.number,
        {
          params: {
            date: normalizedDate,
            cashier_id: user_id || undefined,
            winner: winner ? 'true' : undefined,
          },
        }
      );
    },
    staleTime: 30_000,
    refetchOnWindowFocus: true,
  });
};
