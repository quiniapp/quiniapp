import { INewPollaEditionEntity } from '@helper/request/polla-edition.request';
import { useMutation, useQueryClient, UseMutationOptions } from '@tanstack/react-query';
import { BACKEND_ROUTES } from '../../../../routes/routes.ts';
import { toast } from 'react-hot-toast';
import { fetchWithAuth } from '@/lib/fetchWithAuth';

const createPollaEdition = async (newEdition: INewPollaEditionEntity) => {
  const response = await fetchWithAuth(BACKEND_ROUTES.polla_edition.base, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(newEdition),
  });

  if (!response.ok) {
    const errorData = await response.json();
    throw new Error(errorData.error?.message || `Error: ${response.status}`);
  }

  return await response.json();
};

type UseCreatePollaEditionOptions = Omit<
  UseMutationOptions<unknown, Error, INewPollaEditionEntity>,
  'mutationFn'
> & {
  suppressToast?: boolean;
};

export const useCreatePollaEdition = (_?: undefined, options?: UseCreatePollaEditionOptions) => {
  const queryClient = useQueryClient();
  const { onSuccess, onError, suppressToast, ...rest } = options ?? {};

  return useMutation({
    mutationFn: createPollaEdition,
    ...rest,
    onSuccess: async (data, variables, context) => {
      await queryClient.invalidateQueries({ queryKey: ['polla-editions'], exact: false });

      if (!suppressToast) {
        toast.success('Edición de Polla creada exitosamente');
      }
      onSuccess?.(data, variables, context);
    },
    onError: (error, variables, context) => {
      if (!suppressToast) {
        toast.error(`Error al crear la edición de Polla: ${error.message}`);
      }
      onError?.(error, variables, context);
    },
  });
};
