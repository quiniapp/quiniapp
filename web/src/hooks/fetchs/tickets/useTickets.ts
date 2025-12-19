import { useQuery } from '@tanstack/react-query';
import dayjs from 'dayjs';
import { ITicketEntityFront } from '@helper/types/ticket.type';
import { BACKEND_ROUTES } from '../../../../routes/routes';
import { IPaginatedResponse } from '@helper/request/pagination.request';
import { apiClient } from '@/lib/apiClient';

interface UseTicketsParams {
  user_id?: string;
  date?: string;
  winner?: boolean;
  paid?: boolean | null;
  not_paid?: boolean | null;
  enabled?: boolean;
}

export const useTickets = ({
  user_id,
  date,
  winner,
  enabled = true,
  paid,
  not_paid,
}: UseTicketsParams) => {
  const normalizedDate = date ?? dayjs().format('YYYY-MM-DD');

  return useQuery<ITicketEntityFront[]>({
    queryKey: ['tickets', user_id ?? null, normalizedDate, winner, paid ?? null, not_paid ?? null],
    enabled,
    queryFn: async () => {
      const data = await apiClient.get<IPaginatedResponse<ITicketEntityFront>>(
        BACKEND_ROUTES.ticket.base,
        {
          params: {
            date: normalizedDate,
            cashier_id: user_id || undefined,
            winner: winner ? 'true' : undefined,
            paid: paid ? 'true' : not_paid ? 'false' : undefined,
          },
        }
      );
      return data?.data ?? [];
    },
    refetchOnWindowFocus: true,
  });
};
