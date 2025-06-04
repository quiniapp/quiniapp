import { useQuery } from '@tanstack/react-query';
import { ROUTES } from '../../routes/routes';

const fetchLotteries = async () => {
  const res = await fetch(ROUTES.lottery.base, {
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
  });
  if (!res.ok) throw new Error('Error fetching lotteries');
  return res.json();
};

export const useLotteries = () => useQuery({ queryKey: ['lotteries'], queryFn: fetchLotteries });
