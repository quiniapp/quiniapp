import { useMutation, useQueryClient } from '@tanstack/react-query';
import { BACKEND_ROUTES } from '../../../../routes/routes.ts';
import { fetchWithAuth } from '@/lib/fetchWithAuth';

const calculateCurrentAccount = async (date?: string | null): Promise<void> => {
  const url = `${BACKEND_ROUTES.current_account.calculate}${date ? `?date=${date}` : ''}`;

  const res = await fetchWithAuth(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
  });

  if (!res.ok) {
    const errorText = await res.text();
    throw new Error(`Error calculating current account: ${errorText}`);
  }

  return;
};

export const useCalculateCurrentAccount = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (date?: string | null) => calculateCurrentAccount(date),
    onSuccess: async () => {
      // Refetch forzado de cuenta corriente para garantizar datos frescos
      await queryClient.refetchQueries({ queryKey: ['getCurrentAccount'] });
    },
  });
};
