import { useMutation, useQueryClient } from '@tanstack/react-query';
import { BACKEND_ROUTES } from '../../../../routes/routes.ts';
import { fetchWithAuth } from '@/lib/fetchWithAuth';
import { orgExpensesKey } from '@/hooks/fetchs/org-expense/useGetOrgExpenses';

type CreateExpensePayload = { date: string; name: string; amount: number; group_id?: string | null };

export function useCreateOrgExpense() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (payload: CreateExpensePayload) => {
      const res = await fetchWithAuth(BACKEND_ROUTES.org_expense.base, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (!res.ok) throw new Error('Error creating expense');
      const json = await res.json();
      return json?.data?.expense;
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({
        queryKey: orgExpensesKey(variables.date, variables.group_id),
      });
    },
  });
}
