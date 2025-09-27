import { useQuery } from '@tanstack/react-query';
import dayjs from 'dayjs';
import { ITicketEntityFront } from '../../../../../helper/types/ticket.type';
import { BACKEND_ROUTES } from '../../../../routes/routes';

interface UseTicketsParams {
  user_id?: string;
  date?: string;
  winner?: boolean;
  enabled?: boolean; // 👈 parámetro opcional para controlar el query
}

export const useTickets = ({
  user_id,
  date,
  winner,
  enabled = true, // por default habilitado
}: UseTicketsParams) => {
  const normalizedDate = date ?? dayjs().format('YYYY-MM-DD');

  return useQuery<ITicketEntityFront[]>({
    queryKey: ['tickets', user_id ?? null, normalizedDate, winner],
    enabled, // 👈 se puede deshabilitar desde afuera si querés
    queryFn: async () => {
      const params = new URLSearchParams({ date: normalizedDate });

      if (user_id) params.append('cashier_id', user_id);
      if (winner) params.append('winner', 'true');

      const res = await fetch(`${BACKEND_ROUTES.ticket.base}?${params.toString()}`, {
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
      });
      if (!res.ok) throw new Error('Error fetching tickets');
      const { data } = await res.json();
      return data.ticket;
    },
    refetchOnWindowFocus: true,
  });
};
