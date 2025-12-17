import { IUpdateScheduleEntity } from '@helper/request/schedule.request';
import { useMutation, useQueryClient, UseMutationOptions } from '@tanstack/react-query';
import { BACKEND_ROUTES } from '../../../../routes/routes.ts';
import { toast } from 'react-hot-toast';

interface UpdateScheduleParams {
  schedule_id: string;
  updateSchedule: IUpdateScheduleEntity;
}

const updateSchedule = async ({ schedule_id, updateSchedule }: UpdateScheduleParams) => {
  const response = await fetch(`${BACKEND_ROUTES.schedule.base}/${schedule_id}`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
    },
    credentials: 'include',
    body: JSON.stringify({ updateSchedule }),
  });

  if (!response.ok) {
    const errorData = await response.json();
    throw new Error(errorData.error?.message || `Error: ${response.status}`);
  }

  return await response.json();
};

type UseUpdateScheduleOptions = Omit<
  UseMutationOptions<unknown, Error, UpdateScheduleParams>,
  'mutationFn'
>;

export const useUpdateSchedule = (
  _?: undefined,
  options?: UseUpdateScheduleOptions
) => {
  const queryClient = useQueryClient();
  const { onSuccess, onError, ...rest } = options ?? {};

  return useMutation({
    mutationFn: updateSchedule,
    ...rest,
    onSuccess: async (data, variables, context) => {
      await queryClient.invalidateQueries({
        queryKey: ['schedules'],
        exact: false, // asegura que invalida ['schedules', { all: true/false }]
      });
      // Also invalidate schedule-lottery cache since updating schedule (especially active status) affects it
      await queryClient.invalidateQueries({
        queryKey: ['schedule-lottery'],
        exact: false,
      });

      toast.success('Turno actualizado correctamente');
      onSuccess?.(data, variables, context);
    },
    onError: (error, variables, context) => {
      toast.error(`Error al actualizar turno: ${error.message}`);
      onError?.(error, variables, context);
    },
  });
};
