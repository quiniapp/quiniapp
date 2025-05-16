import { useQuery } from '@tanstack/react-query';
import { ROUTES } from '../../routes/routes';

const fetchBets = async () => {
  const res = await fetch(ROUTES.bet.base, {
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
  });
  if (!res.ok) throw new Error('Error fetching bets');
  return res.json();
};

export const useBets = () => useQuery({ queryKey: ['bets'], queryFn: fetchBets });
