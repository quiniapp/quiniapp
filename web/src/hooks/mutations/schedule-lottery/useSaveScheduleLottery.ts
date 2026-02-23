import { useMutation, useQueryClient, UseMutationOptions } from '@tanstack/react-query';
import { BACKEND_ROUTES } from '../../../../routes/routes.ts';
import { IScheduleLotteryEntityFront } from '@helper/types/schedule-lottery.type.ts';
import { toast } from 'react-hot-toast';
import { fetchWithAuth } from '@/lib/fetchWithAuth';

const saveScheduleLottery = async (scheduleLottery: IScheduleLotteryEntityFront): Promise<IScheduleLotteryEntityFront> => {
  const res = await fetchWithAuth(BACKEND_ROUTES.schedule_lottery.base, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ scheduleLottery: scheduleLottery }),
  });

  if (!res.ok) {
    const errorText = await res.text();
    throw new Error(`Error updating schedule-lottery: ${errorText}`);
  }

  const responseData = await res.json();
  return responseData.data.scheduleLotteries;
};

type UseSaveScheduleLotteryOptions = Omit<
  UseMutationOptions<IScheduleLotteryEntityFront, Error, IScheduleLotteryEntityFront>,
  'mutationFn'
>;

export const useSaveScheduleLottery = (
  _?: undefined,
  options?: UseSaveScheduleLotteryOptions
) => {
  const queryClient = useQueryClient();
  const { onSuccess, onError, ...rest } = options ?? {};

  return useMutation({
    mutationFn: saveScheduleLottery,
    ...rest,
    onSuccess: async (data, variables, context) => {
      // Update cache synchronously with server response
      queryClient.setQueryData(['schedule-lottery'], data);

      // Still invalidate lotteries since active status may have changed
      await queryClient.invalidateQueries({
        queryKey: ['lotteries'],
        exact: false,
      });

      toast.success('Guardado correctamente');
      onSuccess?.(data, variables, context);
    },
    onError: (error, variables, context) => {
      toast.error(`Ocurrió un error: ${error.message}`);
      onError?.(error, variables, context);
    },
  });
};
