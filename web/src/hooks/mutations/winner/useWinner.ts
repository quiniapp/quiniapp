import { useMutation, useQueryClient } from '@tanstack/react-query';
import { ROUTES } from '../../../../routes/routes.ts';

const generateWinners = async ({schedule_id, date}:{schedule_id?:string, date:string}) => {
  if(!schedule_id) return
  const response = await fetch(`${ROUTES.winners.base}/${schedule_id}?date=${date}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    credentials: 'include', // si usás auth por cookie
  });

  if (!response.ok) {
    throw new Error(`Error: ${response.status}`);
  }

  return response.json();
};

export const useGenerateWinners = ({schedule_id, date}:{schedule_id?:string, date:string}) => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ()=>generateWinners({schedule_id,date}),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['winners'] });
    },
  });
};
