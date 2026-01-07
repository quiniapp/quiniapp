import { useMutation, useQueryClient } from '@tanstack/react-query';
import { BACKEND_ROUTES } from '../../../../routes/routes.ts';
import { IOrganizationEntityFront } from '@helper/types/organization.type.ts';
import { INewUserEntity } from '@helper/request/user.request.ts';
import toast from 'react-hot-toast';

interface CreateGroupPayload {
  parentOrgId: string;
  organization: { name: string };
  superAdmin?: INewUserEntity; // Optional - SUPERADMIN for the group
}

const createGroup = async (payload: CreateGroupPayload): Promise<IOrganizationEntityFront> => {
  const response = await fetch(BACKEND_ROUTES.organization.createSub(payload.parentOrgId), {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    credentials: 'include',
    body: JSON.stringify({
      organization: payload.organization,
      superAdmin: payload.superAdmin,
    }),
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(error?.error?.message || 'Error al crear grupo');
  }

  const { data } = await response.json();
  return data.organization;
};

export const useCreateGroup = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: createGroup,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['groups'] });
      toast.success('Grupo creado exitosamente');
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Error al crear grupo');
    },
  });
};
