import { useMutation, useQueryClient } from '@tanstack/react-query';
import { BACKEND_ROUTES } from '../../../../routes/routes.ts';
import { IOrganizationEntityFront } from '@helper/types/organization.type.ts';
import { fetchWithAuth } from '@/lib/fetchWithAuth';

interface UpdateGroupPayload {
  group_id: string;
  name: string;
}

const updateGroup = async (payload: UpdateGroupPayload): Promise<IOrganizationEntityFront> => {
  const response = await fetchWithAuth(BACKEND_ROUTES.organization.id(payload.group_id), {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ updateOrganization: { name: payload.name } }),
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(error?.error?.message || 'Error al actualizar grupo');
  }

  const { data } = await response.json();
  return data.organization;
};

export const useUpdateGroup = (organizationId: string | null) => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: updateGroup,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['groups', organizationId] });
    },
  });
};
