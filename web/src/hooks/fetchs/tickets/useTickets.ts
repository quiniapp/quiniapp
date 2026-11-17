import { useQuery } from '@tanstack/react-query';
import dayjs from 'dayjs';
import { ITicketEntityFront } from '@helper/types/ticket.type';
import { ALL_PAGES_SIZE, fetchAllPages } from '@/lib/fetchAllPages';
import { fetchTicketsPage } from './useInfiniteTickets';

interface UseTicketsParams {
  user_id?: string;
  date?: string;
  winner?: boolean;
  paid?: boolean | null;
  not_paid?: boolean | null;
  enabled?: boolean;
}

/**
 * Todos los tickets del filtro (recorre las páginas hasta el final): la cuenta
 * corriente y el PDF de liquidación necesitan el total, no la primera página.
 */
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
    queryFn: () =>
      fetchAllPages((cursor) =>
        fetchTicketsPage(
          { user_id, date: normalizedDate, winner, paid, not_paid, limit: ALL_PAGES_SIZE },
          cursor
        )
      ),
    refetchOnWindowFocus: true,
    staleTime: 30_000, // 30s — refetch on focus only if data is older than 30s; mutations invalidate immediately
  });
};
