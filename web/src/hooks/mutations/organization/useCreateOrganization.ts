import { useMutation, useQueryClient } from '@tanstack/react-query';
import { BACKEND_ROUTES } from '../../../../routes/routes.ts';
import { IOrganizationEntityFront } from '@helper/types/organization.type.ts';
import { INewOrganizationEntity } from '@helper/request/organization.request.ts';
import { INewUserEntity } from '@helper/request/user.request.ts';

interface CreateOrganizationWithSuperAdminPayload {
  organization: INewOrganizationEntity;
  superAdmin: INewUserEntity;
}

const createOrganization = async (payload: CreateOrganizationWithSuperAdminPayload): Promise<IOrganizationEntityFront> => {
  const response = await fetch(BACKEND_ROUTES.organization.base, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    credentials: 'include',
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(error?.error?.message || 'Error al crear organización');
  }

  const { data } = await response.json();
  return data.organization;
};

export const useCreateOrganization = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: createOrganization,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['organizations'] });
    },
  });
};
