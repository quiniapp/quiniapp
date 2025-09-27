import { useMutation, useQueryClient } from '@tanstack/react-query';
import { BACKEND_ROUTES } from '../../../../routes/routes.ts';

const updateCurrentAccount = async (date?: string | null, leave?: boolean): Promise<void> => {
  const url = `${BACKEND_ROUTES.current_account.base}${date ? `?date=${date}` : ''}${leave ? '&leave=true' : ''}`;

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
    mutationFn: (date?: string | null) => updateCurrentAccount(date),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['getCurrentAccount'] });
    },
  });
};
