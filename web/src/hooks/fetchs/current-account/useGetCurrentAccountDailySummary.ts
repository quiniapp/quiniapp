import { useQuery } from '@tanstack/react-query';
import { BACKEND_ROUTES } from '../../../../routes/routes.ts';
import { fetchWithAuth } from '@/lib/fetchWithAuth';

export type DailySummaryEntry = {
  date: string;
  total_pass: number;
  total_successes: number;
  total_claims: number;
  total_subtotal: number;
  total_previous_balance: number;
  total_collections: number;
  total_paid: number;
  total_total: number;
  total_drag: number;
  total_leave: number;
};

export const currentAccountDailySummaryKey = (
  date_from?: string | null,
  date_to?: string | null,
  group_id?: string | null
) => ['getCurrentAccountDailySummary', date_from ?? '', date_to ?? '', group_id ?? ''] as const;

export async function fetchCurrentAccountDailySummary(
  date_from: string,
  date_to: string,
  group_id?: string | null
): Promise<DailySummaryEntry[]> {
  const params = new URLSearchParams({ date_from, date_to });
  if (group_id) params.set('group_id', group_id);

  const res = await fetchWithAuth(
    `${BACKEND_ROUTES.current_account.daily_summary}?${params.toString()}`,
    { headers: { 'Content-Type': 'application/json' } }
  );
  if (!res.ok) throw new Error('Error fetching daily summary');

  const json = await res.json();
  return json?.data?.summary ?? [];
}

export function useGetCurrentAccountDailySummary(
  date_from?: string | null,
  date_to?: string | null,
  group_id?: string | null
) {
  return useQuery<DailySummaryEntry[]>({
    queryKey: currentAccountDailySummaryKey(date_from, date_to, group_id),
    queryFn: () => fetchCurrentAccountDailySummary(date_from!, date_to!, group_id),
    enabled: !!date_from && !!date_to,
    staleTime: 5 * 60 * 1000,
    refetchOnWindowFocus: false,
  });
}
