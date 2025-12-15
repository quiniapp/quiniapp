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
    staleTime: 5 * 60 * 1000, // 5 minutos - tiempo razonable para refetch
    gcTime: 30 * 60 * 1000, // 30 minutos en caché
    refetchOnWindowFocus: true, // Refetch cuando vuelve al tab
    refetchOnReconnect: true,
    refetchOnMount: true, // IMPORTANTE: refetch después de invalidaciones
    retry: 1,
  });
