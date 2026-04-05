import { useMutation, useQueryClient } from '@tanstack/react-query';
import { BACKEND_ROUTES } from '../../../../routes/routes.ts';
import { fetchWithAuth } from '@/lib/fetchWithAuth';

const liquidateCurrentAccount = async (date?: string | null, leave?: boolean): Promise<void> => {
  const url = `${BACKEND_ROUTES.current_account.liquidate}${date ? `?date=${date}` : ''}${leave ? '&leave=true' : ''}`;

  const res = await fetchWithAuth(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
  });

  if (!res.ok) {
    const errorText = await res.text();
    throw new Error(`Error liquidating current account: ${errorText}`);
  }

  return;
};

export const useLiquidateCurrentAccount = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ date, leave }: { date?: string | null; leave?: boolean }) =>
      liquidateCurrentAccount(date, leave),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['getCurrentAccount'] });
    },
  });
};
