import {  IUpdateScheduleEntity } from "@helper/request/schedule.request";
import { useMutation, UseMutationOptions, useQueryClient } from "@tanstack/react-query";
import { BACKEND_ROUTES } from "../../../../routes/routes.ts";

interface UpdateScheduleParams {
  schedule_id: string;
  updateSchedule: Omit<IUpdateScheduleEntity, 'organization_id'>;
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

export const useUpdateSchedule = (
  options?: UseMutationOptions<any, Error, UpdateScheduleParams>
) => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: updateSchedule,
    onSuccess: async (...args) => {
      await queryClient.invalidateQueries({ queryKey: ['schedules'] });
      options?.onSuccess?.(...args);
    },
    ...options,
  });
};
