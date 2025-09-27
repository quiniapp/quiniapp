import { useMutation, useQueryClient } from '@tanstack/react-query';
import { BACKEND_ROUTES } from '../../../../routes/routes.ts';
import { IScheduleLotteryEntityFront } from '../../../../../helper/types/schedule-lottery.type.ts';

const saveScheduleLottery = async (scheduleLottery: IScheduleLotteryEntityFront): Promise<void> => {
   
  const res = await fetch(BACKEND_ROUTES.schedule_lottery.base, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    credentials: 'include',
    body: JSON.stringify({scheduleLottery: scheduleLottery}),
  });

  if (!res.ok) {
    const errorText = await res.text();
    throw new Error(`Error updating schedule-lottery: ${errorText}`);
  }

  return;
};

export const useSaveScheduleLottery = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ( scheduleLottery : IScheduleLotteryEntityFront ) =>
      saveScheduleLottery(scheduleLottery),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['schedule-lottery'] });
    },
  });
};
