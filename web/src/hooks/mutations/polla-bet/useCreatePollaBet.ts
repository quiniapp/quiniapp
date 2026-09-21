import { useMutation, useQueryClient, UseMutationOptions } from '@tanstack/react-query';
import { BACKEND_ROUTES } from '../../../../routes/routes.ts';
import { toast } from 'react-hot-toast';
import { fetchWithAuth } from '@/lib/fetchWithAuth';

interface CreatePollaBetParams {
  polla_edition_id: string;
  numbers: string[];
  user_id: string | null;
  user_name: string;
}

const createPollaBet = async (newBet: CreatePollaBetParams) => {
  const response = await fetchWithAuth(BACKEND_ROUTES.polla_bet.base, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(newBet),
  });

  if (!response.ok) {
    const errorData = await response.json();
    throw new Error(errorData.error?.message || `Error: ${response.status}`);
  }

  return await response.json();
};

type UseCreatePollaBetOptions = Omit<
  UseMutationOptions<unknown, Error, CreatePollaBetParams>,
  'mutationFn'
> & {
  suppressToast?: boolean;
};

export const useCreatePollaBet = (_?: undefined, options?: UseCreatePollaBetOptions) => {
  const queryClient = useQueryClient();
  const { onSuccess, onError, suppressToast, ...rest } = options ?? {};

  return useMutation({
    mutationFn: createPollaBet,
    ...rest,
    onSuccess: async (data, variables, context) => {
      await queryClient.invalidateQueries({ queryKey: ['polla-bets'], exact: false });

      if (!suppressToast) {
        toast.success('Jugada de Polla cargada exitosamente');
      }
      onSuccess?.(data, variables, context);
    },
    onError: (error, variables, context) => {
      if (!suppressToast) {
        toast.error(`Error al cargar la jugada de Polla: ${error.message}`);
      }
      onError?.(error, variables, context);
    },
  });
};
