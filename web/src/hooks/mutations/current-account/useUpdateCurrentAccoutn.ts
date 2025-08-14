import { useMutation, useQueryClient } from '@tanstack/react-query';
import { ROUTES } from '../../../../routes/routes.ts';

const updateCurrentAccount = async (date: string): Promise<void> => {
  const url = `${ROUTES.current_account.base}?date=${date}`;

  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    credentials: 'include',
  });

  if (!res.ok) {
    const errorText = await res.text();
    throw new Error(`Error updating schedule-lottery: ${errorText}`);
  }

  return;
};

export const useUpdateCurrentAcoount = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (date: string) => updateCurrentAccount(date),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['getCurrentAccoutns'] });
    },
  });
};
