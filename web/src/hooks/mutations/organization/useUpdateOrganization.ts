import { useMutation, useQueryClient } from '@tanstack/react-query';
import { BACKEND_ROUTES } from '../../../../routes/routes.ts';
import { IOrganizationEntityFront } from '@helper/types/organization.type.ts';

interface UpdateOrganizationPayload {
  organization_id: string;
  name: string;
}

const updateOrganization = async (payload: UpdateOrganizationPayload): Promise<IOrganizationEntityFront> => {
  const response = await fetch(BACKEND_ROUTES.organization.id(payload.organization_id), {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
    },
    credentials: 'include',
    body: JSON.stringify({ updateOrganization: { name: payload.name } }),
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(error?.error?.message || 'Error al actualizar organización');
  }

  const { data } = await response.json();
  return data.organization;
};

export const useUpdateOrganization = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: updateOrganization,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['organizations'] });
    },
  });
};
