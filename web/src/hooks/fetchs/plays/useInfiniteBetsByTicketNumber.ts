import { useInfiniteQuery } from '@tanstack/react-query';
import { BACKEND_ROUTES } from '../../../../routes/routes.ts';
import { IBetEntityFront } from '@helper/types/bet.type.ts';
import { IPaginatedBetsResponse } from '@helper/request/pagination.request';
import { fetchWithAuth } from '@/lib/fetchWithAuth';

export interface FetchInfiniteBetsByTicketNumberProps {
  lottery_id?: string | null;
  schedule_id?: string | null;
  date?: string | null;
  cashier_id?: string | null;
  winners?: string | null;
  tern?: string | null;
  quatern?: string | null;
  ticket_number?: string | null;
  limit?: number;
}

const DEFAULT_LIMIT = 100;

const EMPTY_PAGE: IPaginatedBetsResponse<IBetEntityFront> = {
  data: [],
  pagination: { pageSize: 0, hasMore: false, next_cursor: null },
};

function dateFromTicketNumber(ticket_number: string): string {
  const raw = ticket_number.slice(0, 8);
  return `${raw.slice(0, 4)}-${raw.slice(4, 6)}-${raw.slice(6, 8)}`;
}

/** Jugadas de un ticket, modo lista con keyset (`cursor` vacío = primera página). */
export async function fetchPaginatedBetsByTicketNumber(
  props: FetchInfiniteBetsByTicketNumberProps,
  cursor: string = ''
): Promise<IPaginatedBetsResponse<IBetEntityFront>> {
  const {
    schedule_id,
    lottery_id,
    cashier_id,
    winners,
    quatern,
    tern,
    ticket_number,
    limit = DEFAULT_LIMIT,
  } = props;

  const date = ticket_number ? dateFromTicketNumber(ticket_number) : props.date;

  if (!date || !ticket_number) return EMPTY_PAGE;

  const params = new URLSearchParams({ date, limit: limit.toString() });
  if (cursor) params.append('cursor', cursor);
  if (schedule_id) params.append('schedule_id', schedule_id);
  if (lottery_id) params.append('lottery_id', lottery_id);
  if (cashier_id) params.append('cashier_id', cashier_id);
  if (winners) params.append('winners', winners);
  if (quatern) params.append('quatern', quatern);
  if (tern) params.append('tern', tern);
  params.append('ticket_number', ticket_number);

  const url = `${BACKEND_ROUTES.bet.base}?${params.toString()}`;
  const res = await fetchWithAuth(url, {
    headers: { 'Content-Type': 'application/json' },
  });

  if (!res.ok) throw new Error('Error fetching paginated bets by ticket number');

  const json = await res.json();
  return json?.data?.bets ?? EMPTY_PAGE;
}

export const useInfiniteBetsByTicketNumber = (props: FetchInfiniteBetsByTicketNumberProps) => {
  const limit = props.limit ?? DEFAULT_LIMIT;

  return useInfiniteQuery({
    queryKey: [
      'bets-infinite-by-ticket',
      props.date ?? '',
      props.cashier_id ?? '',
      props.schedule_id ?? '',
      props.lottery_id ?? '',
      props.winners ?? '',
      props.quatern ?? '',
      props.tern ?? '',
      props.ticket_number ?? '',
      limit,
    ],
    queryFn: ({ pageParam }) => fetchPaginatedBetsByTicketNumber({ ...props, limit }, pageParam),
    initialPageParam: '',
    getNextPageParam: (lastPage) =>
      lastPage.pagination.hasMore ? (lastPage.pagination.next_cursor ?? undefined) : undefined,
    enabled: Boolean(props.ticket_number),
  });
};
