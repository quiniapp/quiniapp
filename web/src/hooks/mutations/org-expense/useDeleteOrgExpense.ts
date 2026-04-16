import { useMutation, useQueryClient } from '@tanstack/react-query';
import { BACKEND_ROUTES } from '../../../../routes/routes.ts';
import { fetchWithAuth } from '@/lib/fetchWithAuth';
import { orgExpensesKey } from '@/hooks/fetchs/org-expense/useGetOrgExpenses';

export function useDeleteOrgExpense(date?: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (expense_id: string) => {
      const res = await fetchWithAuth(BACKEND_ROUTES.org_expense.id(expense_id), {
        method: 'DELETE',
      });
      if (!res.ok) throw new Error('Error deleting expense');
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: orgExpensesKey(date) });
    },
  });
}
