import { useQuery } from '@tanstack/react-query';
import { BACKEND_ROUTES } from '../../../../routes/routes';
import { IUserEntityFront, USER_TYPE } from '@helper/types/user.type';
import { apiClient } from '@/lib/apiClient';

const fetchUsersByNumber = async (cashier_number?: number): Promise<IUserEntityFront | undefined> => {
  if (!cashier_number) return;
  const users = await apiClient.get<IUserEntityFront[]>(BACKEND_ROUTES.user.base, {
    params: {
      cashier_number: cashier_number.toString(),
      filter_user_type: USER_TYPE.CASHIER,
    },
  });
  return users[0] ?? null;
};

export const useGetUserByNumber = (cashier_number?: number) => {
  return useQuery<IUserEntityFront | undefined>({
    queryKey: ['users', cashier_number],
    queryFn: () => fetchUsersByNumber(cashier_number),
    enabled: !!cashier_number, // solo se ejecuta si hay número
    retry: false,
    refetchOnWindowFocus: false,
  });
};
