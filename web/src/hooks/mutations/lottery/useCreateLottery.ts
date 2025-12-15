import { INewLotteryEntity } from "@helper/request/lottery.request";
import { useMutation, UseMutationOptions, useQueryClient } from "@tanstack/react-query";
import { BACKEND_ROUTES } from "../../../../routes/routes.ts";


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

export const useCreateLottery = (
  options?: UseMutationOptions<any, Error, Omit<INewLotteryEntity, 'organization_id'>>
) => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: createLottery,
    onSuccess: async (...args) => {
      await queryClient.invalidateQueries({ queryKey: ['lotteries'] });
      options?.onSuccess?.(...args);
    },
    ...options,
  });
};
