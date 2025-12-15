import { useInfiniteQuery } from '@tanstack/react-query';
import { ITicketEntityFront } from '@helper/types/ticket.type';
import { IPaginatedResponse } from '@helper/request/pagination.request';
import { BACKEND_ROUTES } from '../../../../routes/routes';
import dayjs from 'dayjs';

interface FetchInfiniteTicketsProps {
  user_id?: string;
  date?: string;
  winner?: boolean;
  paid?: boolean | null;
  not_paid?: boolean | null;
  limit?: number;
}

const fetchPaginatedTickets = async (
  props: FetchInfiniteTicketsProps,
  page: number
): Promise<IPaginatedResponse<ITicketEntityFront>> => {
  const normalizedDate = props.date ?? dayjs().format('YYYY-MM-DD');
  const params = new URLSearchParams({
    date: normalizedDate,
    page: page.toString(),
    limit: (props.limit ?? 100).toString(),
  });

  if (props.user_id) params.append('cashier_id', props.user_id);
  if (props.winner) params.append('winner', 'true');
  if (props.paid) params.append('paid', 'true');
  if (props.not_paid) params.append('paid', 'false');

  const res = await fetch(`${BACKEND_ROUTES.ticket.base}?${params.toString()}`, {
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
  });

  if (!res.ok) throw new Error('Error fetching tickets');

  const { data } = await res.json();
  return data?.ticket ?? {
    data: [],
    pagination: {
      currentPage: 1,
      pageSize: 0,
      totalCount: 0,
      totalPages: 0,
      hasMore: false,
    },
  };
};

export const useInfiniteTickets = (props: FetchInfiniteTicketsProps) => {
  return useInfiniteQuery<IPaginatedResponse<ITicketEntityFront>>({
    queryKey: [
      'tickets-infinite',
      props.user_id ?? null,
      props.date ?? null,
      props.winner ?? null,
      props.paid ?? null,
      props.not_paid ?? null,
      props.limit ?? 150,
    ],
    queryFn: ({ pageParam = 1 }) => fetchPaginatedTickets(props, pageParam as number),
    getNextPageParam: (lastPage) => {
      return lastPage.pagination.hasMore ? lastPage.pagination.currentPage + 1 : undefined;
    },
    enabled: Boolean(props.date),
    initialPageParam: 1,
  });
};
