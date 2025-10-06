import { useQuery } from '@tanstack/react-query';
import { BACKEND_ROUTES } from '../../../../routes/routes.ts';
import { ICurrentAccountEntityFront } from '@helper/types/current_account.type.ts';

export const CURRENT_ACCOUNT_LATEST = 'latest';

export const currentAccountKey = (date?: string | null) =>
  ['getCurrentAccount', date ?? CURRENT_ACCOUNT_LATEST] as const;

type ApiResponse = { data?: { currentAccount?: ICurrentAccountEntityFront[] } };

export async function fetchCurrentAccount(date?: string | null): Promise<ICurrentAccountEntityFront[]> {
  // si hay date, la mandamos; si no, dejamos que el backend devuelva la última
  const url =
    `${BACKEND_ROUTES.current_account.base}` +
    (date ? `?date=${encodeURIComponent(date)}` : '');

  const res = await fetch(url, {
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
  });
  if (!res.ok) throw new Error('Error fetching results');

  const json: ApiResponse = await res.json();
  return json?.data?.currentAccount ?? [];
}

export function useGetCurrentAccount(date?: string | null) {
  return useQuery<ICurrentAccountEntityFront[]>({
    queryKey: currentAccountKey(date),
    queryFn: () => fetchCurrentAccount(date),
    // siempre habilitado porque el backend soporta "sin fecha"
    staleTime: 60_000,
    gcTime: 5 * 60_000,
  });
}
