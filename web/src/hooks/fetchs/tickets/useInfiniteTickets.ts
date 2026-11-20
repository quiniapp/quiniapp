import { useInfiniteQuery } from '@tanstack/react-query';
import { ITicketEntityFront } from '@helper/types/ticket.type';
import { IKeysetPaginatedResponse } from '@helper/request/pagination.request';
import { BACKEND_ROUTES } from '../../../../routes/routes';
import dayjs from 'dayjs';
import { apiClient } from '@/lib/apiClient';

export interface FetchTicketsProps {
  user_id?: string;
  date?: string;
  winner?: boolean;
  paid?: boolean | null;
  not_paid?: boolean | null;
  limit?: number;
  group_id?: string | null;
}

const DEFAULT_LIMIT = 100;

/**
 * Una página de GET /ticket (keyset; `cursor` vacío = primera página). Solo la
 * primera trae `pagination.totalCount` (todos los tickets del filtro).
 */
export const fetchTicketsPage = async (
  props: FetchTicketsProps,
  cursor: string
): Promise<IKeysetPaginatedResponse<ITicketEntityFront>> => {
  const normalizedDate = props.date ?? dayjs().format('YYYY-MM-DD');

  const data = await apiClient.get<IKeysetPaginatedResponse<ITicketEntityFront>>(
    BACKEND_ROUTES.ticket.base,
    {
      params: {
        date: normalizedDate,
        cursor: cursor || undefined,
        limit: (props.limit ?? DEFAULT_LIMIT).toString(),
        cashier_id: props.user_id || undefined,
        winner: props.winner ? 'true' : undefined,
        paid: props.paid ? 'true' : props.not_paid ? 'false' : undefined,
        group_id: props.group_id || undefined,
      },
    }
  );

  return data ?? { data: [], pagination: { pageSize: 0, hasMore: false, next_cursor: null } };
};

export const useInfiniteTickets = (props: FetchTicketsProps) => {
  const limit = props.limit ?? DEFAULT_LIMIT;

  return useInfiniteQuery({
    queryKey: [
      'tickets-infinite',
      props.user_id ?? null,
      props.date ?? null,
      props.winner ?? null,
      props.paid ?? null,
      props.not_paid ?? null,
      limit,
      props.group_id ?? '',
    ],
    queryFn: ({ pageParam }) => fetchTicketsPage({ ...props, limit }, pageParam),
    initialPageParam: '',
    getNextPageParam: (lastPage) =>
      lastPage.pagination.hasMore ? (lastPage.pagination.next_cursor ?? undefined) : undefined,
    enabled: Boolean(props.date),
  });
};
