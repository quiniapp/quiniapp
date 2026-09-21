import { IUpdatePollaEditionEntity } from '@helper/request/polla-edition.request';
import { useMutation, useQueryClient, UseMutationOptions } from '@tanstack/react-query';
import { BACKEND_ROUTES } from '../../../../routes/routes.ts';
import { toast } from 'react-hot-toast';
import { fetchWithAuth } from '@/lib/fetchWithAuth';

interface UpdatePollaEditionParams {
  polla_edition_id: string;
  updateEdition: IUpdatePollaEditionEntity;
}

const updatePollaEdition = async ({ polla_edition_id, updateEdition }: UpdatePollaEditionParams) => {
  const response = await fetchWithAuth(BACKEND_ROUTES.polla_edition.id(polla_edition_id), {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(updateEdition),
  });

  if (!response.ok) {
    const errorData = await response.json();
    throw new Error(errorData.error?.message || `Error: ${response.status}`);
  }

  return await response.json();
};

type UseUpdatePollaEditionOptions = Omit<
  UseMutationOptions<unknown, Error, UpdatePollaEditionParams>,
  'mutationFn'
> & {
  suppressToast?: boolean;
};

export const useUpdatePollaEdition = (_?: undefined, options?: UseUpdatePollaEditionOptions) => {
  const queryClient = useQueryClient();
  const { onSuccess, onError, suppressToast, ...rest } = options ?? {};

  return useMutation({
    mutationFn: updatePollaEdition,
    ...rest,
    onSuccess: async (data, variables, context) => {
      await queryClient.invalidateQueries({ queryKey: ['polla-editions'], exact: false });

      if (!suppressToast) {
        toast.success('Edición de Polla actualizada correctamente');
      }
      onSuccess?.(data, variables, context);
    },
    onError: (error, variables, context) => {
      if (!suppressToast) {
        toast.error(`Error al actualizar la edición de Polla: ${error.message}`);
      }
      onError?.(error, variables, context);
    },
  });
};
