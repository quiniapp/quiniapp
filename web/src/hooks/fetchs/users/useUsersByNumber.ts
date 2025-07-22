import { useQuery } from '@tanstack/react-query';
import { ROUTES } from '../../../../routes/routes.ts';

const fetchUsersByNumber = async (cashier_number?: number) => {
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

  return await response.json();
};

export const useUsersByNumber = (cashier_number?: number) => {
  return useQuery({
    queryKey: ['users', cashier_number],
    queryFn: () => fetchUsersByNumber(cashier_number),
    enabled: !!cashier_number, // solo se ejecuta si hay número
    retry: false,
    refetchOnWindowFocus: false,
  });
};
