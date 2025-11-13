import { useMutation, useQueryClient } from '@tanstack/react-query';
import { BACKEND_ROUTES } from '../../../../routes/routes.ts';

const generateWinners = async ({schedule_id, date}:{schedule_id?:string, date:string}) => {
  if(!schedule_id) return
  const response = await fetch(`${BACKEND_ROUTES.winners.base}/${schedule_id}?date=${date}`, {
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
    onSuccess: async () => {
      // Refetch forzado de ganadores y cuenta corriente para garantizar datos frescos
      await queryClient.refetchQueries({ queryKey: ['winners'] });
      await queryClient.refetchQueries({ queryKey: ['getCurrentAccount'] });
    },
  });
};
