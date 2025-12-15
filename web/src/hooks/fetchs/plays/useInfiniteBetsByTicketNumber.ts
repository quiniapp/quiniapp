import { useInfiniteQuery } from '@tanstack/react-query';
import { BACKEND_ROUTES } from '../../../../routes/routes.ts';
import { IBetEntityFront } from '@helper/types/bet.type.ts';
import { IPaginatedBetsResponse } from '@helper/request/pagination.request';

export interface FetchInfiniteBetsByTicketNumberProps {
  lottery_id?: string | null;
  schedule_id?: string | null;
  date?: string | null;
  cashier_id?: string | null;
  grouped?: string | null;
  winners?: string | null;
  tern?: string | null;
  quatern?: string | null;
  ticket_number?: string | null;
  limit?: number;
}

export async function fetchPaginatedBetsByTicketNumber(
  props: FetchInfiniteBetsByTicketNumberProps,
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
  } = props;

  if (!date || !ticket_number) {
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

  const url = `${BACKEND_ROUTES.bet.base}?${params.toString()}`;
  const res = await fetch(url, {
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
  });

  if (!res.ok) throw new Error('Error fetching paginated bets by ticket number');

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

export const useInfiniteBetsByTicketNumber = (props: FetchInfiniteBetsByTicketNumberProps) => {
  return useInfiniteQuery<IPaginatedBetsResponse<IBetEntityFront>>({
    queryKey: [
      'bets-infinite-by-ticket',
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
    ],
    queryFn: ({ pageParam = 1 }) => fetchPaginatedBetsByTicketNumber(props, pageParam as number),
    getNextPageParam: (lastPage) => {
      return lastPage.pagination.hasMore ? lastPage.pagination.currentPage + 1 : undefined;
    },
    enabled: Boolean(props.date && props.ticket_number),
    initialPageParam: 1,
  });
};
