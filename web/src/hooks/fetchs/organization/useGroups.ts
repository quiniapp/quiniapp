import { useQuery } from '@tanstack/react-query';
import { BACKEND_ROUTES } from '../../../../routes/routes.ts';
import { IOrganizationEntityFront } from '@helper/types/organization.type.ts';
import { USER_TYPE } from '@helper/types/user.type.ts';

const fetchGroups = async (organizationId: string) => {
  const response = await fetch(BACKEND_ROUTES.organization.children(organizationId), {
    method: 'GET',
    headers: {
      'Content-Type': 'application/json',
    },
    credentials: 'include',
  });

  if (!response.ok) {
    throw new Error(`Error: ${response.status}`);
  }
  const { data } = await response.json();
  return data.organizations;
};

export const useGroups = (organizationId: string | null, role: USER_TYPE | null) => {
  return useQuery<IOrganizationEntityFront[]>({
    queryKey: ['groups', organizationId],
    queryFn: () => fetchGroups(organizationId!),
    enabled: !!organizationId && !!role && [USER_TYPE.OWNER, USER_TYPE.CAPITALIST].includes(role),
    staleTime: 5 * 60 * 1000,
    gcTime: 30 * 60 * 1000,
    refetchOnWindowFocus: true,
    refetchOnReconnect: true,
    refetchOnMount: true,
    retry: 1,
  });
};
