import { useQuery } from '@tanstack/react-query';
import { BACKEND_ROUTES } from '../../../../routes/routes.ts';
import { fetchWithAuth } from '@/lib/fetchWithAuth';

export type OrgExpense = {
  expense_id: string;
  organization_id: string;
  group_id: string | null;
  date: string;
  name: string;
  amount: number;
};

export const orgExpensesKey = (date?: string | null, groupId?: string | null) =>
  ['orgExpenses', date ?? '', groupId ?? ''] as const;

export async function fetchOrgExpenses(date: string, groupId?: string | null): Promise<OrgExpense[]> {
  let url = `${BACKEND_ROUTES.org_expense.base}?date=${encodeURIComponent(date)}`;
  if (groupId) url += `&group_id=${encodeURIComponent(groupId)}`;
  const res = await fetchWithAuth(url, { headers: { 'Content-Type': 'application/json' } });
  if (!res.ok) throw new Error('Error fetching expenses');
  const json = await res.json();
  return json?.data?.expenses ?? [];
}

export function useGetOrgExpenses(date?: string | null, groupId?: string | null) {
  return useQuery<OrgExpense[]>({
    queryKey: orgExpensesKey(date, groupId),
    queryFn: () => fetchOrgExpenses(date!, groupId),
    enabled: !!date,
    staleTime: 2 * 60 * 1000,
    refetchOnWindowFocus: false,
  });
}
