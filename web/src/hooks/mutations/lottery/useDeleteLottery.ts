

import { useMutation, UseMutationOptions, useQueryClient } from '@tanstack/react-query';
import { BACKEND_ROUTES } from '../../../../routes/routes.ts';

const deleteLottery = async (lottery_id: string) => {
  const response = await fetch(`${BACKEND_ROUTES.lottery.base}/${lottery_id}`, {
    method: 'DELETE',
    headers: {
      'Content-Type': 'application/json',
    },
    credentials: 'include',
  });

  if (!response.ok) {
    const errorData = await response.json();
    throw new Error(errorData.error?.message || `Error: ${response.status}`);
  }

  return await response.json();
};

export const useDeleteLottery = (
  options?: UseMutationOptions<any, Error, string>
) => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: deleteLottery,
    onSuccess: async (...args) => {
      await queryClient.invalidateQueries({ queryKey: ['lotteries'] });
      options?.onSuccess?.(...args);
    },
    ...options,
  });
};
