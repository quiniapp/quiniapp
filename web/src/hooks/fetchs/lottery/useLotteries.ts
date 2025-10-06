import { useQuery } from '@tanstack/react-query';
import { BACKEND_ROUTES } from '../../../../routes/routes';
import { ILotteryEntityFront } from '@helper/types/lottery.type';

const fetchLotteries = async (all?: boolean) => {
  const res = await fetch(`${BACKEND_ROUTES.lottery.base}${all ? '?all=true' : ''}`, {
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
  });
  if (!res.ok) throw new Error('Error fetching lotteries');
  return await res.json().then((res) => res.data.lottery);
};

export const useLotteries = (all?: boolean) =>
  useQuery<ILotteryEntityFront[]>({
    queryKey: ['lotteries', { all: !!all }],
    queryFn: () => fetchLotteries(all),
    staleTime: 12 * 60 * 60 * 1000, // 12 horas sin refetch por foco/mount
    gcTime: 60 * 60 * 1000, // 60 minutos en caché aunque no haya subscriptores
    refetchOnWindowFocus: false,
    refetchOnReconnect: true,
    refetchOnMount: false,
    retry: 1,
  });
