import { useQuery } from '@tanstack/react-query';
import { ROUTES } from '../../routes/routes';
import { ILotteryEntityFront } from '../../../helper/types/lottery.type';

const fetchLotteries = async (all?: boolean) => {
  const res = await fetch(`${ROUTES.lottery.base}${all ? '?all=true' : ''}`, {
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
  });
  if (!res.ok) throw new Error('Error fetching lotteries');
  return await res.json().then((res) => res.data.lottery);
};

export const useLotteries = (all?: boolean) =>
  useQuery<ILotteryEntityFront[]>({ queryKey: ['lotteries'], queryFn: () => fetchLotteries(all) });
