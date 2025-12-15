import { INewLotteryEntity } from '@helper/request/lottery.request';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { BACKEND_ROUTES } from '../../../../routes/routes.ts';

const createLottery = async (newLottery: Omit<INewLotteryEntity, 'organization_id'>) => {
  const response = await fetch(BACKEND_ROUTES.lottery.base, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    credentials: 'include',
    body: JSON.stringify(newLottery),
  });

  if (!response.ok) {
    const errorData = await response.json();
    throw new Error(errorData.error?.message || `Error: ${response.status}`);
  }

  return await response.json();
};

export const useCreateLottery = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: createLottery,
    onSuccess: async () => {
      await queryClient.invalidateQueries({
        queryKey: ['lotteries'],
        exact: false,
        refetchType: 'active',
      });
    },
  });
};
