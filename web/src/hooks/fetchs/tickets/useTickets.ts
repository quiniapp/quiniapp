import { useQuery } from '@tanstack/react-query';
import { ROUTES } from '../../../../routes/routes';
import dayjs from 'dayjs';
import { ITicketEntityFront } from '../../../../../helper/types/ticket.type';

export const useTickets = ({
  user_id,
  date,
  winner,
}: {
  user_id?: string;
  date?: string;
  winner?: boolean;
}) => {
  const normalizedDate = date ?? dayjs().format('YYYY-MM-DD');

  return useQuery<ITicketEntityFront[]>({
    queryKey: ['tickets', user_id ?? null, normalizedDate, winner],
    queryFn: async () => {
      const res = await fetch(
        `${ROUTES.ticket.base}?date=${normalizedDate}${user_id ? `&cashier_id=${user_id}` : ''}${winner ? `&winner=true` : ''}`,
        { headers: { 'Content-Type': 'application/json' }, credentials: 'include' }
      );
      if (!res.ok) throw new Error('Error fetching tickets');
      const { data } = await res.json();
      return data.ticket;
    },
  });
};
