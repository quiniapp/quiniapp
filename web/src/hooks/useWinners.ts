import { useQuery } from '@tanstack/react-query';
import { BACKEND_ROUTES } from '../../routes/routes';

const fetchWinners = async () => {
  const res = await fetch(BACKEND_ROUTES.winners.base, {
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
  });
  if (!res.ok) throw new Error('Error fetching winners');
  return res.json();
};

export const useWinners = () => useQuery({ queryKey: ['winners'], queryFn: fetchWinners });
