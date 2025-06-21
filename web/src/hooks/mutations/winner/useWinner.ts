import { useMutation, useQueryClient } from '@tanstack/react-query';
import { ROUTES } from '../../../../routes/routes.ts';

const generateWinners = async () => {
  const response = await fetch(ROUTES.winners.base, {
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

export const useGenerateWinners = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: generateWinners,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['winners'] });
    },
  });
};
