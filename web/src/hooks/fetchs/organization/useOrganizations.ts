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

    staleTime: 5 * 60 * 1000, // 5 minutos - tiempo razonable para refetch
    gcTime: 30 * 60 * 1000, // 30 minutos en caché
    refetchOnWindowFocus: true, // Refetch cuando vuelve al tab
    refetchOnReconnect: true,
    refetchOnMount: true, // IMPORTANTE: refetch después de invalidaciones
    retry: 1,
  });
};
