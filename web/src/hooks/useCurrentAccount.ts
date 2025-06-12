import { useQuery } from '@tanstack/react-query';
import { ROUTES } from '../../routes/routes';

const fetchCurrentAccount = async () => {
  const res = await fetch(ROUTES.current_account.base, {
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
  });
  if (!res.ok) throw new Error('Error fetching current account');
  return res.json();
};

export const useCurrentAccounts = () => useQuery({ queryKey: ['current_account'], queryFn: fetchCurrentAccount });
