import { useQuery } from '@tanstack/react-query';
import { BACKEND_ROUTES } from '../../../../routes/routes';
import { IUserEntityFront, USER_TYPE } from '@helper/types/user.type';
import { apiClient } from '@/lib/apiClient';

const fetchUsers = async (filterUserType?: USER_TYPE) => {
  const params = new URLSearchParams();
  if (filterUserType) {
    params.append('filter_user_type', filterUserType);
  }

  const url = params.toString()
    ? `${BACKEND_ROUTES.user.base}?${params.toString()}`
    : BACKEND_ROUTES.user.base;

  return await apiClient.get<IUserEntityFront[]>(url);
};

export const useUsers = (role: USER_TYPE | null, filterUserType?: USER_TYPE) => {
  return useQuery<IUserEntityFront[]>({
    queryKey: ['users', role, filterUserType], // include filter in key
    queryFn: () => fetchUsers(filterUserType),
    enabled: !!role && role !== USER_TYPE.CASHIER, // disable if cashier

    staleTime: 5 * 60 * 1000, // 5 minutes
    gcTime: 30 * 60 * 1000, // 30 minutes cache
    refetchOnWindowFocus: true,
    refetchOnReconnect: true,
    refetchOnMount: true,
    retry: 1,
  });
};
