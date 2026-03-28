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
}

export async function fetchPaginatedBets(
  props: FetchInfiniteBetsProps,
  pageParam: number = 1
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
    limit = 150,
    group_id,
  } = props;

  if (!date) {
    return {
      data: [],
      pagination: {
        currentPage: 1,
        pageSize: 0,
        totalCount: 0,
        totalPages: 0,
        hasMore: false,
      },
    };
  }

  const params = new URLSearchParams({ date, page: pageParam.toString(), limit: limit.toString() });
  if (schedule_id) params.append('schedule_id', schedule_id);
  if (lottery_id) params.append('lottery_id', lottery_id);
  if (cashier_id) params.append('cashier_id', cashier_id);
  if (grouped) params.append('grouped', grouped);
  if (winners) params.append('winners', winners);
  if (quatern) params.append('quatern', quatern);
  if (tern) params.append('tern', tern);
  if (ticket_number) params.append('ticket_number', ticket_number);
  if (group_id) params.append('group_id', group_id);

  const url = `${BACKEND_ROUTES.bet.base}?${params.toString()}`;
  const res = await fetchWithAuth(url, {
    headers: { 'Content-Type': 'application/json' },
  });

  if (!res.ok) throw new Error('Error fetching paginated bets');

  const json = await res.json();
  return json?.data?.bets ?? {
    data: [],
    pagination: {
      currentPage: 1,
      pageSize: 0,
      totalCount: 0,
      totalPages: 0,
      hasMore: false,
    },
  };
}

export const useInfiniteBets = (props: FetchInfiniteBetsProps) => {
  return useInfiniteQuery<IPaginatedBetsResponse<IBetEntityFront>>({
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
      props.limit ?? 100,
      props.group_id ?? '',
    ],
    queryFn: ({ pageParam = 1 }) => fetchPaginatedBets(props, pageParam as number),
    getNextPageParam: (lastPage) => {
      return lastPage.pagination.hasMore ? lastPage.pagination.currentPage + 1 : undefined;
    },
    enabled: Boolean(props.date),
    initialPageParam: 1,
  });
};
