import { useMutation, useQueryClient } from '@tanstack/react-query';
import { BACKEND_ROUTES } from '../../../../routes/routes';
import { IUserEntityFront } from '@helper/types/user.type';
import toast from 'react-hot-toast';
import { fetchWithAuth } from '@/lib/fetchWithAuth';

interface RemoveUserPayload {
  user_id: string;
  group_id: string;
}

const removeUserFromGroup = async (payload: RemoveUserPayload): Promise<IUserEntityFront> => {
  const response = await fetchWithAuth(BACKEND_ROUTES.user.removeFromGroup, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(error?.error?.message || 'Error al eliminar usuario del grupo');
  }

  const { data } = await response.json();
  return data.user;
};

export const useRemoveUserFromGroup = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: removeUserFromGroup,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['assignable-users'] });
      queryClient.invalidateQueries({ queryKey: ['groups'] });
      queryClient.invalidateQueries({ queryKey: ['users'] });
      queryClient.invalidateQueries({ queryKey: ['group-users'] });
      toast.success('Usuario eliminado del grupo exitosamente');
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Error al eliminar usuario del grupo');
    },
  });
};
