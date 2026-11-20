import { useInfiniteQuery } from '@tanstack/react-query';
import { BACKEND_ROUTES } from '../../../../routes/routes.ts';
import { IBetEntityFront } from '@helper/types/bet.type.ts';
import { IPaginatedBetsResponse } from '@helper/request/pagination.request';
import { fetchWithAuth } from '@/lib/fetchWithAuth';

export interface FetchInfiniteBetsProps {
  lottery_id?: string | null;
  schedule_id?: string | null;
  date: string | null;
  cashier_id?: string | null;
  grouped?: string | null;
  winners?: string | null;
  tern?: string | null;
  quatern?: string | null;
  ticket_number?: string | null;
  limit?: number;
  group_id?: string | null;
  min_amount?: number | null;
}

const DEFAULT_LIMIT = 100;

/**
 * Modo lista: keyset (`pageParam` = cursor, `''` en la primera página).
 * Modo agrupado: offset (`pageParam` = número de página, desde 1).
 */
export type BetsPageParam = string | number;

const EMPTY_PAGE: IPaginatedBetsResponse<IBetEntityFront> = {
  data: [],
  pagination: { pageSize: 0, hasMore: false, next_cursor: null },
};

export async function fetchPaginatedBets(
  props: FetchInfiniteBetsProps,
  pageParam: BetsPageParam = props.grouped === 'true' ? 1 : ''
): Promise<IPaginatedBetsResponse<IBetEntityFront>> {
  const {
    date,
    schedule_id,
    lottery_id,
    cashier_id,
    grouped,
    winners,
    quatern,
    tern,
    ticket_number,
    limit = DEFAULT_LIMIT,
    group_id,
    min_amount,
  } = props;

  if (!date) return EMPTY_PAGE;

  const params = new URLSearchParams({ date, limit: limit.toString() });
  if (grouped === 'true') params.append('page', String(pageParam || 1));
  else if (pageParam) params.append('cursor', String(pageParam));
  if (schedule_id) params.append('schedule_id', schedule_id);
  if (lottery_id) params.append('lottery_id', lottery_id);
  if (cashier_id) params.append('cashier_id', cashier_id);
  if (grouped) params.append('grouped', grouped);
  if (winners) params.append('winners', winners);
  if (quatern) params.append('quatern', quatern);
  if (tern) params.append('tern', tern);
  if (ticket_number) params.append('ticket_number', ticket_number);
  if (group_id) params.append('group_id', group_id);
  if (min_amount != null && min_amount > 0) params.append('min_amount', String(min_amount));

  const url = `${BACKEND_ROUTES.bet.base}?${params.toString()}`;
  const res = await fetchWithAuth(url, {
    headers: { 'Content-Type': 'application/json' },
  });

  if (!res.ok) throw new Error('Error fetching paginated bets');

  const json = await res.json();
  return json?.data?.bets ?? EMPTY_PAGE;
}

/** Siguiente `pageParam` según el modo; `undefined` cuando no hay más. */
export const nextBetsPageParam = (
  lastPage: IPaginatedBetsResponse<IBetEntityFront>,
  lastPageParam: BetsPageParam,
  grouped: boolean
): BetsPageParam | undefined => {
  if (!lastPage.pagination.hasMore) return undefined;
  if (grouped) return Number(lastPageParam) + 1;
  return lastPage.pagination.next_cursor ?? undefined;
};

export const useInfiniteBets = (props: FetchInfiniteBetsProps) => {
  const grouped = props.grouped === 'true';
  const limit = props.limit ?? DEFAULT_LIMIT;

  return useInfiniteQuery({
    queryKey: [
      'bets-infinite',
      props.date ?? '',
      props.cashier_id ?? '',
      props.schedule_id ?? '',
      props.lottery_id ?? '',
      props.grouped ?? '',
      props.winners ?? '',
      props.quatern ?? '',
      props.tern ?? '',
      props.ticket_number ?? '',
      limit,
      props.group_id ?? '',
      props.min_amount ?? 0,
    ],
    queryFn: ({ pageParam }) => fetchPaginatedBets({ ...props, limit }, pageParam),
    initialPageParam: (grouped ? 1 : '') as BetsPageParam,
    getNextPageParam: (lastPage, _allPages, lastPageParam) =>
      nextBetsPageParam(lastPage, lastPageParam, grouped),
    enabled: Boolean(props.date),
  });
};
