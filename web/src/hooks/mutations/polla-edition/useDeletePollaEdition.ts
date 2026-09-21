import { useMutation, useQueryClient, UseMutationOptions } from '@tanstack/react-query';
import { BACKEND_ROUTES } from '../../../../routes/routes.ts';
import { toast } from 'react-hot-toast';
import { fetchWithAuth } from '@/lib/fetchWithAuth';

const deletePollaEdition = async (polla_edition_id: string) => {
  const response = await fetchWithAuth(BACKEND_ROUTES.polla_edition.id(polla_edition_id), {
    method: 'DELETE',
    headers: { 'Content-Type': 'application/json' },
  });

  if (!response.ok) {
    const errorData = await response.json();
    throw new Error(errorData.error?.message || `Error: ${response.status}`);
  }

  return await response.json();
};

type UseDeletePollaEditionOptions = Omit<
  UseMutationOptions<unknown, Error, string>,
  'mutationFn'
> & {
  suppressToast?: boolean;
};

export const useDeletePollaEdition = (_?: undefined, options?: UseDeletePollaEditionOptions) => {
  const queryClient = useQueryClient();
  const { onSuccess, onError, suppressToast, ...rest } = options ?? {};

  return useMutation({
    mutationFn: deletePollaEdition,
    ...rest,
    onSuccess: async (data, variables, context) => {
      await queryClient.invalidateQueries({ queryKey: ['polla-editions'], exact: false });

      if (!suppressToast) {
        toast.success('Edición de Polla eliminada correctamente');
      }
      onSuccess?.(data, variables, context);
    },
    onError: (error, variables, context) => {
      if (!suppressToast) {
        toast.error(`Error al eliminar la edición de Polla: ${error.message}`);
      }
      onError?.(error, variables, context);
    },
  });
};
