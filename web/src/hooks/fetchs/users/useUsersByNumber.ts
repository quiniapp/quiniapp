import { useQuery } from '@tanstack/react-query';
import { ROUTES } from '../../../../routes/routes.ts';
import { IUserEntityFront } from '../../../../../helper/types/user.type';

const fetchUsersByNumber = async (cashier_number?: number): Promise<IUserEntityFront | undefined> => {
  if (!cashier_number) return;
  const response = await fetch(`${ROUTES.user.base}?cashier_number=${cashier_number}`, {
    method: 'GET',
    headers: {
      'Content-Type': 'application/json',
    },
    credentials: 'include', // si usás auth por cookie
  });

  if (!response.ok) {
    throw new Error(`Error: ${response.status}`);
  }
  const {data} =  await response.json();
  return data.users[0] ?? null
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
