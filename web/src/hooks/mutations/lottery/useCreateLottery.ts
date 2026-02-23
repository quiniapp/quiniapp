import { INewLotteryEntity } from '@helper/request/lottery.request';
import { useMutation, useQueryClient, UseMutationOptions } from '@tanstack/react-query';
import { BACKEND_ROUTES } from '../../../../routes/routes.ts';
import { toast } from 'react-hot-toast';
import { fetchWithAuth } from '@/lib/fetchWithAuth';

const createLottery = async (newLottery: INewLotteryEntity) => {
  const response = await fetchWithAuth(BACKEND_ROUTES.lottery.base, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(newLottery),
  });

  if (!response.ok) {
    const errorData = await response.json();
    throw new Error(errorData.error?.message || `Error: ${response.status}`);
  }

  return await response.json();
};

type UseCreateLotteryOptions = Omit<
  UseMutationOptions<unknown, Error, INewLotteryEntity>,
  'mutationFn'
> & {
  suppressToast?: boolean;
};

export const useCreateLottery = (_?: undefined, options?: UseCreateLotteryOptions) => {
  const queryClient = useQueryClient();
  const { onSuccess, onError, suppressToast, ...rest } = options ?? {};

  return useMutation({
    mutationFn: createLottery,
    ...rest,
    onSuccess: async (data, variables, context) => {
      await queryClient.invalidateQueries({
        queryKey: ['lotteries'],
        exact: false, // asegura que invalida ['lotteries', { all: true/false }]
      });

      if (!suppressToast) {
        toast.success('Lotería creada exitosamente');
      }
      onSuccess?.(data, variables, context);
    },
    onError: (error, variables, context) => {
      if (!suppressToast) {
        toast.error(`Error al crear lotería: ${error.message}`);
      }
      onError?.(error, variables, context);
    },
  });
};
