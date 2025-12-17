import { INewScheduleEntity } from '@helper/request/schedule.request';
import { useMutation, useQueryClient, UseMutationOptions } from '@tanstack/react-query';
import { BACKEND_ROUTES } from '../../../../routes/routes.ts';
import { toast } from 'react-hot-toast';

const createSchedule = async (newSchedule: INewScheduleEntity) => {
  const response = await fetch(BACKEND_ROUTES.schedule.base, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    credentials: 'include',
    body: JSON.stringify({ newSchedule }),
  });

  if (!response.ok) {
    const errorData = await response.json();
    throw new Error(errorData.error?.message || `Error: ${response.status}`);
  }

  return await response.json();
};

type UseCreateScheduleOptions = Omit<
  UseMutationOptions<unknown, Error, INewScheduleEntity>,
  'mutationFn'
>;

export const useCreateSchedule = (
  _?: undefined,
  options?: UseCreateScheduleOptions
) => {
  const queryClient = useQueryClient();
  const { onSuccess, onError, ...rest } = options ?? {};

  return useMutation({
    mutationFn: createSchedule,
    ...rest,
    onSuccess: async (data, variables, context) => {
      await queryClient.invalidateQueries({
        queryKey: ['schedules'],
        exact: false, // asegura que invalida ['schedules', { all: true/false }]
      });

      toast.success('Turno creado exitosamente');
      onSuccess?.(data, variables, context);
    },
    onError: (error, variables, context) => {
      toast.error(`Error al crear turno: ${error.message}`);
      onError?.(error, variables, context);
    },
  });
};
