import { useQuery } from '@tanstack/react-query';
import { BACKEND_ROUTES } from '../../../../routes/routes.ts';
import { IUserEntityFront, USER_TYPE } from '@helper/types/user.type.ts';

const fetchUsers = async ( ) => {
  const response = await fetch(BACKEND_ROUTES.user.base, {
    method: 'GET',
    headers: {
      'Content-Type': 'application/json',
    },
    credentials: 'include', // si usás auth por cookie
  });

  if (!response.ok) {
    throw new Error(`Error: ${response.status}`);
  }
  const {data} = await response.json();
  return data.users;
};

export const useUsers = (role: USER_TYPE | null) => {
  return useQuery<IUserEntityFront[]>({
    queryKey: ['users', role], // incluyo role en la key por si cambia
    queryFn:  fetchUsers,
    enabled: !!role && role !== USER_TYPE.CASHIER, // deshabilita si es cashier

    staleTime: 5 * 60 * 1000, // 5 minutos - tiempo razonable para refetch
    gcTime: 30 * 60 * 1000, // 30 minutos en caché
    refetchOnWindowFocus: true, // Refetch cuando vuelve al tab
    refetchOnReconnect: true,
    refetchOnMount: true, // IMPORTANTE: refetch después de invalidaciones
    retry: 1,
  });
};
