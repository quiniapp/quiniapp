import { useCallback } from 'react';
import {
  useInfiniteQuery,
  useMutation,
  useQuery,
  useQueryClient,
  keepPreviousData,
  InfiniteData,
  UseMutationOptions,
  UseQueryOptions,
} from '@tanstack/react-query';
import { toast } from 'react-hot-toast';
import { IPaginatedResponse } from '@helper/request/pagination.request';
import { apiClient } from '@/lib/apiClient';

export interface PollaPage<T> extends IPaginatedResponse<T> {
  next_cursor?: string | null;
}

export type QueryParams = Record<string, string | number | boolean | undefined | null>;

/** Descarta los filtros vacíos para que la query key sea estable. */
export const cleanParams = (params: QueryParams): Record<string, string | number | boolean> => {
  const out: Record<string, string | number | boolean> = {};
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== '') out[key] = value;
  });
  return out;
};

export const useApiQuery = <T>(
  key: unknown[],
  url: string,
  params: QueryParams = {},
  options?: Partial<UseQueryOptions<T>>
) => {
  const clean = cleanParams(params);

  return useQuery<T>({
    queryKey: [...key, clean],
    queryFn: () => apiClient.get<T>(url, { params: clean }),
    // Las listas filtradas no parpadean al cambiar de filtro.
    placeholderData: keepPreviousData,
    ...options,
  });
};

/**
 * Listados con scroll infinito, paginados por número de página. Es el patrón
 * de QuiniApp (`useInfiniteBets`): el backend devuelve `hasMore` y el cliente
 * va acumulando páginas.
 */
export const useApiInfiniteQuery = <T>(
  key: unknown[],
  url: string,
  params: QueryParams = {},
  /**
   * `keepPrevious`: al cambiar el filtro se sigue viendo la lista anterior hasta
   * que llega la nueva (buscadores que se refinan mientras se escribe).
   */
  options?: { enabled?: boolean; limit?: number; keepPrevious?: boolean }
) => {
  const clean = cleanParams(params);
  const limit = options?.limit ?? 50;

  return useInfiniteQuery({
    queryKey: [...key, 'infinite', clean, limit],
    queryFn: ({ pageParam }) =>
      apiClient.get<PollaPage<T>>(url, { params: { ...clean, limit, page: pageParam } }),
    initialPageParam: 1,
    getNextPageParam: (lastPage) =>
      lastPage.pagination.hasMore ? lastPage.pagination.currentPage + 1 : undefined,
    enabled: options?.enabled ?? true,
    placeholderData: options?.keepPrevious ? keepPreviousData : undefined,
  });
};

/** Query key de un feed por keyset: la comparten el hook y su "Actualizar". */
const cursorQueryKey = (key: unknown[], params: QueryParams, limit: number) => [
  ...key,
  'cursor',
  cleanParams(params),
  limit,
];

/**
 * Igual, pero paginado por keyset (`next_cursor`). Se usa en el feed de
 * jugadas: con offset, una jugada nueva cargada mientras alguien scrollea
 * corre las filas y se repiten o se saltean.
 */
export const useApiCursorQuery = <T>(
  key: unknown[],
  url: string,
  params: QueryParams = {},
  options?: { enabled?: boolean; limit?: number }
) => {
  const clean = cleanParams(params);
  const limit = options?.limit ?? 50;

  return useInfiniteQuery({
    queryKey: cursorQueryKey(key, params, limit),
    queryFn: ({ pageParam }) =>
      apiClient.get<PollaPage<T>>(url, {
        params: { ...clean, limit, ...(pageParam ? { cursor: pageParam } : {}) },
      }),
    initialPageParam: '',
    getNextPageParam: (lastPage) => lastPage.next_cursor ?? undefined,
    enabled: options?.enabled ?? true,
  });
};

/**
 * "Actualizar" de un feed por keyset: deja solo la primera página y la vuelve a
 * pedir. Refrescar todas con sus cursores viejos saltearía las filas que las
 * jugadas nuevas corren hacia la página siguiente. Mientras llega, se sigue
 * viendo la primera página.
 */
export const useRefreshCursorQuery = () => {
  const queryClient = useQueryClient();

  return useCallback(
    (key: unknown[], params: QueryParams, limit: number) => {
      const queryKey = cursorQueryKey(key, params, limit);
      queryClient.setQueryData<InfiniteData<unknown, string>>(
        queryKey,
        (data) => data && { pages: data.pages.slice(0, 1), pageParams: data.pageParams.slice(0, 1) }
      );
      return queryClient.refetchQueries({ queryKey, exact: true });
    },
    [queryClient]
  );
};

/** Aplana las páginas acumuladas y saca el total de la primera. */
export const flattenPages = <T>(pages?: PollaPage<T>[]) => ({
  rows: pages?.flatMap((p) => p.data) ?? [],
  // El COUNT exacto solo viene en la primera página.
  totalCount: pages?.[0]?.pagination.totalCount ?? 0,
});

interface ApiMutationConfig<TVariables> {
  /** Prefijos de query key a invalidar al terminar. */
  invalidate?: string[];
  successMessage?: string;
  buildUrl?: (variables: TVariables) => string;
}

export const useApiMutation = <TData, TVariables>(
  method: 'post' | 'put' | 'delete',
  url: string | ((variables: TVariables) => string),
  config: ApiMutationConfig<TVariables> = {},
  options?: Omit<UseMutationOptions<TData, Error, TVariables>, 'mutationFn'>
) => {
  const queryClient = useQueryClient();
  const { onSuccess, onError, ...rest } = options ?? {};

  return useMutation<TData, Error, TVariables>({
    mutationFn: (variables) => {
      const endpoint = typeof url === 'function' ? url(variables) : url;
      if (method === 'delete') return apiClient.delete<TData>(endpoint);
      return apiClient[method]<TData>(endpoint, variables);
    },
    ...rest,
    onSuccess: async (data, variables, context) => {
      await Promise.all(
        (config.invalidate ?? []).map((prefix) =>
          queryClient.invalidateQueries({ queryKey: [prefix], exact: false })
        )
      );
      if (config.successMessage) toast.success(config.successMessage);
      onSuccess?.(data, variables, context);
    },
    onError: (error, variables, context) => {
      toast.error(error.message);
      onError?.(error, variables, context);
    },
  });
};
