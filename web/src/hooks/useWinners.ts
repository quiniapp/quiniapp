import { useQuery } from '@tanstack/react-query';
import { ROUTES } from '../../routes/routes';

const fetchWinners = async () => {
  const res = await fetch(ROUTES.winners.base, {
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
  });
  if (!res.ok) throw new Error('Error fetching winners');
  return res.json();
};

export const useWinners = () => useQuery({ queryKey: ['winners'], queryFn: fetchWinners });
