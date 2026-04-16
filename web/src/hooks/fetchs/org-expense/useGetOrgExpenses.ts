import { useQuery } from '@tanstack/react-query';
import { BACKEND_ROUTES } from '../../../../routes/routes.ts';
import { fetchWithAuth } from '@/lib/fetchWithAuth';

export type OrgExpense = {
  expense_id: string;
  organization_id: string;
  date: string;
  name: string;
  amount: number;
};

export const orgExpensesKey = (date?: string | null) =>
  ['orgExpenses', date ?? ''] as const;

export async function fetchOrgExpenses(date: string): Promise<OrgExpense[]> {
  const res = await fetchWithAuth(
    `${BACKEND_ROUTES.org_expense.base}?date=${encodeURIComponent(date)}`,
    { headers: { 'Content-Type': 'application/json' } }
  );
  if (!res.ok) throw new Error('Error fetching expenses');
  const json = await res.json();
  return json?.data?.expenses ?? [];
}

export function useGetOrgExpenses(date?: string | null) {
  return useQuery<OrgExpense[]>({
    queryKey: orgExpensesKey(date),
    queryFn: () => fetchOrgExpenses(date!),
    enabled: !!date,
    staleTime: 2 * 60 * 1000,
    refetchOnWindowFocus: false,
  });
}
