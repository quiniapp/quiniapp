import { useQuery } from '@tanstack/react-query';
import { BACKEND_ROUTES } from '../../../../routes/routes.ts';
import { IOrganizationEntityFront } from '@helper/types/organization.type.ts';
import { USER_TYPE } from '@helper/types/user.type.ts';

const fetchOrganizations = async () => {
  const response = await fetch(BACKEND_ROUTES.organization.base, {
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

export const useOrganizations = (role: USER_TYPE | null) => {
  return useQuery<IOrganizationEntityFront[]>({
    queryKey: ['organizations'],
    queryFn: fetchOrganizations,
    enabled: !!role && role === USER_TYPE.OWNER, // Solo OWNER puede ver organizaciones

    staleTime: 12 * 60 * 60 * 1000, // 12 horas
    gcTime: 60 * 60 * 1000, // 60 minutos
    refetchOnWindowFocus: false,
    refetchOnReconnect: true,
    refetchOnMount: false,
    retry: 1,
  });
};
