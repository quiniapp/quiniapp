import { useMutation, useQueryClient, UseMutationOptions } from '@tanstack/react-query';
import { BACKEND_ROUTES } from '../../../../routes/routes.ts';
import { toast } from 'react-hot-toast';

const deleteSchedule = async (schedule_id: string) => {
  const response = await fetch(`${BACKEND_ROUTES.schedule.base}/${schedule_id}`, {
    method: 'DELETE',
    headers: {
      'Content-Type': 'application/json',
    },
    credentials: 'include',
  });

  if (!response.ok) {
    const errorData = await response.json();
    throw new Error(errorData.error?.message || `Error: ${response.status}`);
  }

  return await response.json();
};

type UseDeleteScheduleOptions = Omit<
  UseMutationOptions<unknown, Error, string>,
  'mutationFn'
>;

export const useDeleteSchedule = (
  _?: undefined,
  options?: UseDeleteScheduleOptions
) => {
  const queryClient = useQueryClient();
  const { onSuccess, onError, ...rest } = options ?? {};

  return useMutation({
    mutationFn: deleteSchedule,
    ...rest,
    onSuccess: async (data, variables, context) => {
      await queryClient.invalidateQueries({
        queryKey: ['schedules'],
        exact: false, // asegura que invalida ['schedules', { all: true/false }]
      });
      // Also invalidate schedule-lottery cache since deleting a schedule affects it
      await queryClient.invalidateQueries({
        queryKey: ['schedule-lottery'],
        exact: false,
      });

      toast.success('Turno eliminado correctamente');
      onSuccess?.(data, variables, context);
    },
    onError: (error, variables, context) => {
      toast.error(`Error al eliminar turno: ${error.message}`);
      onError?.(error, variables, context);
    },
  });
};
