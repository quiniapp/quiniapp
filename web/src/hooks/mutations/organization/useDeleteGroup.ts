import { useMutation, useQueryClient } from '@tanstack/react-query';
import { BACKEND_ROUTES } from '../../../../routes/routes.ts';
import { fetchWithAuth } from '@/lib/fetchWithAuth';

const deleteGroup = async (group_id: string): Promise<void> => {
  const response = await fetchWithAuth(BACKEND_ROUTES.organization.id(group_id), {
    method: 'DELETE',
    headers: { 'Content-Type': 'application/json' },
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(error?.error?.message || 'Error al eliminar grupo');
  }
};

export const useDeleteGroup = (organizationId: string | null) => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: deleteGroup,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['groups', organizationId] });
      queryClient.invalidateQueries({ queryKey: ['users'] });
      queryClient.invalidateQueries({ queryKey: ['assignable-users'] });
    },
  });
};
