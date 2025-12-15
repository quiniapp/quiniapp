import { INewScheduleEntity } from '@helper/request/schedule.request';
import { useMutation, UseMutationOptions, useQueryClient } from '@tanstack/react-query';
import { BACKEND_ROUTES } from '../../../../routes/routes.ts';

const createSchedule = async (newSchedule: Omit<INewScheduleEntity, 'organization_id'>) => {
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

export const useCreateSchedule = (
  options?: UseMutationOptions<any, Error, Omit<INewScheduleEntity, 'organization_id'>>
) => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: createSchedule,
    onSuccess: async (...args) => {
      await queryClient.invalidateQueries({ queryKey: ['schedules'], refetchType: 'active' });
      options?.onSuccess?.(...args);
    },
    ...options,
  });
};
