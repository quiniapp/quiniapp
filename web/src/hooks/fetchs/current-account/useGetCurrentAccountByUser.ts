import { useQuery, QueryFunctionContext } from '@tanstack/react-query';
import { BACKEND_ROUTES } from '../../../../routes/routes.ts';
import { ICurrentAccountEntityFront } from '@helper/types/current_account.type.ts';

export const CURRENT_ACCOUNT_LATEST = 'latest' as const;

// QueryKey SIEMPRE de 3 elementos
export const currentAccountKey = (user_id: string, date?: string | null) =>
  ['getCurrentAccount', user_id, date ?? CURRENT_ACCOUNT_LATEST] as const;

// Alias del tipo de query key para usar en el queryFn y en useQuery
type CurrentAccountKey = ReturnType<typeof currentAccountKey>;

type ApiResponse = { data?: { currentAccount?: ICurrentAccountEntityFront } };

async function fetchCurrentAccountByUserFn(
  ctx: QueryFunctionContext<CurrentAccountKey>
): Promise<ICurrentAccountEntityFront | undefined> {
  const [, user_id, dateOrLatest] = ctx.queryKey;
  const date = dateOrLatest === CURRENT_ACCOUNT_LATEST ? null : dateOrLatest;

  const url =
    `${BACKEND_ROUTES.current_account.id(user_id)}` +
    (date ? `?date=${encodeURIComponent(date)}` : '');

  const res = await fetch(url, {
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    signal: ctx.signal,
  });
  if (!res.ok) throw new Error('Error fetching results');

  const json: ApiResponse = await res.json();
  return json?.data?.currentAccount;
}

export function useGetCurrentAccountByUser(
  user_id: string | undefined,
  date?: string | null
) {
  return useQuery<
    ICurrentAccountEntityFront | undefined, // TQueryFnData (lo que devuelve el queryFn)
    Error,                                  // TError
    ICurrentAccountEntityFront | undefined, // TData (lo que consume el componente)
    CurrentAccountKey                       // TQueryKey
  >({
    queryKey: currentAccountKey(user_id ?? 'disabled', date),
    queryFn: fetchCurrentAccountByUserFn,
    enabled: !!user_id, // evita request cuando no hay user_id
    staleTime: 60_000,
    gcTime: 5 * 60_000,
    // refetchOnWindowFocus: false,
    // keepPreviousData: true,
  });
}
