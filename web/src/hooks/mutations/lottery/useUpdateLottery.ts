import { IUpdateLotteryEntity } from '@helper/request/lottery.request';
import { useMutation, useQueryClient, UseMutationOptions } from '@tanstack/react-query';
import { BACKEND_ROUTES } from '../../../../routes/routes.ts';
import { toast } from 'react-hot-toast';

interface UpdateLotteryParams {
  lottery_id: string;
  updateLottery: IUpdateLotteryEntity;
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

type UseUpdateLotteryOptions = Omit<
  UseMutationOptions<unknown, Error, UpdateLotteryParams>,
  'mutationFn'
> & {
  suppressToast?: boolean;
};

export const useUpdateLottery = (
  _?: undefined,
  options?: UseUpdateLotteryOptions
) => {
  const queryClient = useQueryClient();
  const { onSuccess, onError, suppressToast, ...rest } = options ?? {};

  return useMutation({
    mutationFn: updateLottery,
    ...rest,
    onSuccess: async (data, variables, context) => {
      await queryClient.invalidateQueries({
        queryKey: ['lotteries'],
        exact: false, // asegura que invalida ['lotteries', { all: true/false }]
      });

      if (!suppressToast) {
        toast.success('Lotería actualizada correctamente');
      }
      onSuccess?.(data, variables, context);
    },
    onError: (error, variables, context) => {
      if (!suppressToast) {
        toast.error(`Error al actualizar la lotería: ${error.message}`);
      }
      onError?.(error, variables, context);
    },
  });
};
