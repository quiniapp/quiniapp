
import { useMutation, useQueryClient, UseMutationOptions } from '@tanstack/react-query';
import { BACKEND_ROUTES } from '../../../../routes/routes.ts';
import { toast } from 'react-hot-toast';

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

type UseDeleteLotteryOptions = Omit<
  UseMutationOptions<unknown, Error, string>,
  'mutationFn'
> & {
  suppressToast?: boolean;
};

export const useDeleteLottery = (
  _?: undefined,
  options?: UseDeleteLotteryOptions
) => {
  const queryClient = useQueryClient();
  const { onSuccess, onError, suppressToast, ...rest } = options ?? {};

  return useMutation({
    mutationFn: deleteLottery,
    ...rest,
    onSuccess: async (data, variables, context) => {
      await queryClient.invalidateQueries({
        queryKey: ['lotteries'],
        exact: false, // asegura que invalida ['lotteries', { all: true/false }]
      });
      // Also invalidate schedule-lottery cache since deleting a lottery affects it
      await queryClient.invalidateQueries({
        queryKey: ['schedule-lottery'],
        exact: false,
      });

      if (!suppressToast) {
        toast.success('Lotería eliminada correctamente');
      }
      onSuccess?.(data, variables, context);
    },
    onError: (error, variables, context) => {
      if (!suppressToast) {
        toast.error(`Error al eliminar la lotería: ${error.message}`);
      }
      onError?.(error, variables, context);
    },
  });
};
