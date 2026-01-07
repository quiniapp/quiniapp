import { useMutation, useQueryClient } from '@tanstack/react-query';
import { BACKEND_ROUTES } from '../../../../routes/routes';
import { IUserEntityFront } from '@helper/types/user.type';
import toast from 'react-hot-toast';

interface AssignUserPayload {
  user_id: string;
  group_id: string;
}

const assignUserToGroup = async (payload: AssignUserPayload): Promise<IUserEntityFront> => {
  const response = await fetch(BACKEND_ROUTES.user.assignToGroup, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    credentials: 'include',
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(error?.error?.message || 'Error al asignar usuario');
  }

  const { data } = await response.json();
  return data.user;
};

export const useAssignUserToGroup = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: assignUserToGroup,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['assignable-users'] });
      queryClient.invalidateQueries({ queryKey: ['groups'] });
      queryClient.invalidateQueries({ queryKey: ['users'] });
      queryClient.invalidateQueries({ queryKey: ['group-users'] });
      toast.success('Usuario asignado exitosamente');
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Error al asignar usuario');
    },
  });
};
