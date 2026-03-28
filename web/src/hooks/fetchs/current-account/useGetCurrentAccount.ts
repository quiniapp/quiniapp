import { useQuery } from '@tanstack/react-query';
import { BACKEND_ROUTES } from '../../../../routes/routes.ts';
import { ICurrentAccountEntityFront } from '@helper/types/current_account.type.ts';
import { fetchWithAuth } from '@/lib/fetchWithAuth';

export const CURRENT_ACCOUNT_LATEST = 'latest';

export const currentAccountKey = (date?: string | null, group_id?: string | null) =>
  ['getCurrentAccount', date ?? CURRENT_ACCOUNT_LATEST, group_id ?? ''] as const;

type ApiResponse = { data?: { currentAccount?: ICurrentAccountEntityFront[] } };

export async function fetchCurrentAccount(date?: string | null, group_id?: string | null): Promise<ICurrentAccountEntityFront[]> {
  const params = new URLSearchParams();
  if (date) params.set('date', date);
  if (group_id) params.set('group_id', group_id);
  const query = params.toString();
  const url = `${BACKEND_ROUTES.current_account.base}${query ? `?${query}` : ''}`;

  const res = await fetchWithAuth(url, {
    headers: { 'Content-Type': 'application/json' },
  });
  if (!res.ok) throw new Error('Error fetching results');

  const json: ApiResponse = await res.json();
  return json?.data?.currentAccount ?? [];
}

export function useGetCurrentAccount(date?: string | null, group_id?: string | null) {
  return useQuery<ICurrentAccountEntityFront[]>({
    queryKey: currentAccountKey(date, group_id),
    queryFn: () => fetchCurrentAccount(date, group_id),
    enabled: Boolean(date),
  });
}
