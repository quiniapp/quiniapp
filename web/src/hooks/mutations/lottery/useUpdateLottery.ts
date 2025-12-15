
import { IUpdateLotteryEntity } from '@helper/request/lottery.request';
import { useMutation, UseMutationOptions, useQueryClient } from '@tanstack/react-query';
import { BACKEND_ROUTES } from '../../../../routes/routes.ts';

interface UpdateLotteryParams {
  lottery_id: string;
  updateLottery: Omit<IUpdateLotteryEntity, 'organization_id'>;
}

const updateLottery = async ({ lottery_id, updateLottery }: UpdateLotteryParams) => {
  const response = await fetch(`${BACKEND_ROUTES.lottery.base}/${lottery_id}`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
    },
    credentials: 'include',
    body: JSON.stringify({ updateLottery }),
  });

  if (!response.ok) {
    const errorData = await response.json();
    throw new Error(errorData.error?.message || `Error: ${response.status}`);
  }

  return await response.json();
};

export const useUpdateLottery = (
  options?: UseMutationOptions<any, Error, UpdateLotteryParams>
) => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: updateLottery,
    onSuccess: async (...args) => {
      await queryClient.invalidateQueries({ queryKey: ['lotteries'] });
      options?.onSuccess?.(...args);
    },
    ...options,
  });
};
