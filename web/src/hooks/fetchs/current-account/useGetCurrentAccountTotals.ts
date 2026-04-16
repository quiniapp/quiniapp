import { useQuery } from '@tanstack/react-query';
import { BACKEND_ROUTES } from '../../../../routes/routes.ts';
import { fetchWithAuth } from '@/lib/fetchWithAuth';

export type DailyTotalEntry = {
  date: string;
  total_collections: number;
  total_paid: number;
  total_bills: number;
  total_balance: number;
  total_expenses: number;
  net_balance: number;
};

export const currentAccountTotalsKey = (date_from?: string | null, date_to?: string | null, group_id?: string | null) =>
  ['getCurrentAccountTotals', date_from ?? '', date_to ?? '', group_id ?? ''] as const;

export async function fetchCurrentAccountTotals(
  date_from: string,
  date_to: string,
  group_id?: string | null
): Promise<DailyTotalEntry[]> {
  const params = new URLSearchParams({ date_from, date_to });
  if (group_id) params.set('group_id', group_id);

  const res = await fetchWithAuth(`${BACKEND_ROUTES.current_account.totals}?${params.toString()}`, {
    headers: { 'Content-Type': 'application/json' },
  });
  if (!res.ok) throw new Error('Error fetching totals');

  const json = await res.json();
  return json?.data?.totals ?? [];
}

export function useGetCurrentAccountTotals(
  date_from?: string | null,
  date_to?: string | null,
  group_id?: string | null
) {
  return useQuery<DailyTotalEntry[]>({
    queryKey: currentAccountTotalsKey(date_from, date_to, group_id),
    queryFn: () => fetchCurrentAccountTotals(date_from!, date_to!, group_id),
    enabled: !!date_from && !!date_to,
    staleTime: 5 * 60 * 1000,
    refetchOnWindowFocus: false,
  });
}
