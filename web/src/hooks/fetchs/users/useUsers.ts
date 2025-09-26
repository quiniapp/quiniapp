import { useQuery } from '@tanstack/react-query';
import { ROUTES } from '../../../../routes/routes.ts';
import { IUserEntityFront, USER_TYPE } from '../../../../../helper/types/user.type.ts';

const fetchUsers = async ( ) => {
  const response = await fetch(ROUTES.user.base, {
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

    staleTime: 12 * 60 * 60 * 1000, // 12 horas sin refetch por foco/mount
    gcTime: 60 * 60 * 1000, // 60 minutos en caché aunque no haya subscriptores
    refetchOnWindowFocus: false,
    refetchOnReconnect: true,
    refetchOnMount: false,
    retry: 1,
  });
};
