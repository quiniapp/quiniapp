import { useInfiniteQuery } from '@tanstack/react-query';
import { ITicketEntityFront } from '@helper/types/ticket.type';
import { IPaginatedResponse } from '@helper/request/pagination.request';
import { BACKEND_ROUTES } from '../../../../routes/routes';
import dayjs from 'dayjs';
import { apiClient } from '@/lib/apiClient';

interface FetchInfiniteTicketsProps {
  user_id?: string;
  date?: string;
  winner?: boolean;
  paid?: boolean | null;
  not_paid?: boolean | null;
  limit?: number;
  group_id?: string | null;
}

const fetchPaginatedTickets = async (
  props: FetchInfiniteTicketsProps,
  page: number
): Promise<IPaginatedResponse<ITicketEntityFront>> => {
  const normalizedDate = props.date ?? dayjs().format('YYYY-MM-DD');

  const data = await apiClient.get<IPaginatedResponse<ITicketEntityFront>>(
    BACKEND_ROUTES.ticket.base,
    {
      params: {
        date: normalizedDate,
        page: page.toString(),
        limit: (props.limit ?? 100).toString(),
        cashier_id: props.user_id || undefined,
        winner: props.winner ? 'true' : undefined,
        paid: props.paid
          ? 'true'
          : props.not_paid
            ? 'false'
            : undefined,
        group_id: props.group_id || undefined,
      },
    }
  );

  return (
    data ?? {
      data: [],
      pagination: {
        currentPage: 1,
        pageSize: 0,
        totalCount: 0,
        totalPages: 0,
        hasMore: false,
      },
    }
  );
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
      props.group_id ?? '',
    ],
    queryFn: ({ pageParam = 1 }) => fetchPaginatedTickets(props, pageParam as number),
    getNextPageParam: (lastPage) => {
      return lastPage.pagination.hasMore ? lastPage.pagination.currentPage + 1 : undefined;
    },
    enabled: Boolean(props.date),
    initialPageParam: 1,
  });
};
