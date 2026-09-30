import { IPaginatedResponse } from '@helper/request/pagination.request';
import { POLLA_DEFAULT_PAGE_SIZE, POLLA_MAX_PAGE_SIZE } from '@helper/polla/config/session.config';

export interface PollaPagination {
  page: number;
  limit: number;
  from: number;
  to: number;
  /** El COUNT exacto solo se pide en la primera página: es lo más caro de la query. */
  withCount: boolean;
}

export const parsePagination = (query: Record<string, unknown>): PollaPagination => {
  const rawPage = Number(query.page);
  const rawLimit = Number(query.limit);

  const page = Number.isFinite(rawPage) && rawPage > 0 ? Math.floor(rawPage) : 1;
  const limit =
    Number.isFinite(rawLimit) && rawLimit > 0
      ? Math.min(Math.floor(rawLimit), POLLA_MAX_PAGE_SIZE)
      : POLLA_DEFAULT_PAGE_SIZE;

  const from = (page - 1) * limit;

  return {
    page,
    limit,
    from,
    to: from + limit - 1,
    withCount: page === 1 || query.with_count === 'true',
  };
};

export const buildPaginated = <T>(
  data: T[],
  { page, limit }: PollaPagination,
  totalCount: number | null
): IPaginatedResponse<T> => {
  // Sin COUNT (páginas ≥ 2) se infiere: una página llena implica que hay más.
  const knownCount =
    totalCount ?? (page - 1) * limit + data.length + (data.length === limit ? 1 : 0);
  const totalPages = limit > 0 ? Math.ceil(knownCount / limit) : 1;

  return {
    data,
    pagination: {
      currentPage: page,
      pageSize: limit,
      totalCount: totalCount ?? knownCount,
      totalPages,
      hasMore: totalCount !== null ? page < totalPages : data.length === limit,
    },
  };
};
