import { useQuery } from '@tanstack/react-query';
import { ROUTES } from '../../routes/routes';

const fetchLotteries = async (all?: boolean) => {
  const res = await fetch(`${ROUTES.lottery.base}${all ? '?all=true' : ''}`, {
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
  });
  if (!res.ok) throw new Error('Error fetching lotteries');
  return res.json();
};

export const useLotteries = (all?: boolean) =>
  useQuery({ queryKey: ['lotteries'], queryFn: () => fetchLotteries(all) });
