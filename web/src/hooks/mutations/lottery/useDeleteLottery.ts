

import { useMutation, useQueryClient } from '@tanstack/react-query';
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
) => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: deleteLottery,
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['lotteries'],
        exact: false,
        refetchType: 'active', });
    },
  });
};
