import { useMutation, useQueryClient, UseMutationOptions } from '@tanstack/react-query';
import { BACKEND_ROUTES } from '../../../../routes/routes.ts';
import { toast } from 'react-hot-toast';
import { fetchWithAuth } from '@/lib/fetchWithAuth';

const deletePollaBet = async (polla_bet_id: string) => {
  const response = await fetchWithAuth(`${BACKEND_ROUTES.polla_bet.base}/${polla_bet_id}`, {
    method: 'DELETE',
    headers: { 'Content-Type': 'application/json' },
  });

  if (!response.ok) {
    const errorData = await response.json();
    throw new Error(errorData.error?.message || `Error: ${response.status}`);
  }

  return await response.json();
};

type UseDeletePollaBetOptions = Omit<
  UseMutationOptions<unknown, Error, string>,
  'mutationFn'
> & {
  suppressToast?: boolean;
};

export const useDeletePollaBet = (_?: undefined, options?: UseDeletePollaBetOptions) => {
  const queryClient = useQueryClient();
  const { onSuccess, onError, suppressToast, ...rest } = options ?? {};

  return useMutation({
    mutationFn: deletePollaBet,
    ...rest,
    onSuccess: async (data, variables, context) => {
      await queryClient.invalidateQueries({ queryKey: ['polla-bets'], exact: false });

      if (!suppressToast) {
        toast.success('Jugada de Polla eliminada');
      }
      onSuccess?.(data, variables, context);
    },
    onError: (error, variables, context) => {
      if (!suppressToast) {
        toast.error(`Error al eliminar la jugada: ${error.message}`);
      }
      onError?.(error, variables, context);
    },
  });
};
