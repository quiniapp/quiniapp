import { useMutation, useQueryClient, UseMutationOptions } from '@tanstack/react-query';
import { BACKEND_ROUTES } from '../../../../routes/routes.ts';
import { toast } from 'react-hot-toast';
import { fetchWithAuth } from '@/lib/fetchWithAuth';

interface UpdatePollaBetParams {
  polla_bet_id: string;
  numbers: string[];
}

const updatePollaBet = async ({ polla_bet_id, numbers }: UpdatePollaBetParams) => {
  const response = await fetchWithAuth(`${BACKEND_ROUTES.polla_bet.base}/${polla_bet_id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ numbers }),
  });

  if (!response.ok) {
    const errorData = await response.json();
    throw new Error(errorData.error?.message || `Error: ${response.status}`);
  }

  return await response.json();
};

type UseUpdatePollaBetOptions = Omit<
  UseMutationOptions<unknown, Error, UpdatePollaBetParams>,
  'mutationFn'
> & {
  suppressToast?: boolean;
};

export const useUpdatePollaBet = (_?: undefined, options?: UseUpdatePollaBetOptions) => {
  const queryClient = useQueryClient();
  const { onSuccess, onError, suppressToast, ...rest } = options ?? {};

  return useMutation({
    mutationFn: updatePollaBet,
    ...rest,
    onSuccess: async (data, variables, context) => {
      await queryClient.invalidateQueries({ queryKey: ['polla-bets'], exact: false });

      if (!suppressToast) {
        toast.success('Jugada de Polla actualizada');
      }
      onSuccess?.(data, variables, context);
    },
    onError: (error, variables, context) => {
      if (!suppressToast) {
        toast.error(`Error al actualizar la jugada: ${error.message}`);
      }
      onError?.(error, variables, context);
    },
  });
};
