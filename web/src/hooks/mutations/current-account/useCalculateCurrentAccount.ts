import { useMutation, useQueryClient } from '@tanstack/react-query';
import { BACKEND_ROUTES } from '../../../../routes/routes.ts';

const calculateCurrentAccount = async (date?: string | null): Promise<void> => {
  const url = `${BACKEND_ROUTES.current_account.calculate}${date ? `?date=${date}` : ''}`;

  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    credentials: 'include',
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
    onSuccess: () => {
      // Invalidar cache de cuenta corriente para refrescar los datos
      queryClient.invalidateQueries({ queryKey: ['getCurrentAccount'] });
    },
  });
};
