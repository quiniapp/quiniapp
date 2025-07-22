import { useQuery } from '@tanstack/react-query';
import { ROUTES } from '../../../../routes/routes.ts';

const fetchUsers = async () => {
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

  return response.json();
};

export const useUsers = () => {
  return useQuery({
    queryKey: ['users'],
    queryFn: fetchUsers,
    retry: false,
    refetchOnWindowFocus: false,
  });
};
