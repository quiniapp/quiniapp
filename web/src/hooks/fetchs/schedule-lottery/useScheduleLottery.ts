import { useQuery } from '@tanstack/react-query';
import { BACKEND_ROUTES } from '../../../../routes/routes';
import { IScheduleLotteryEntityFront } from '../../../../../helper/types/schedule-lottery.type';

const fetchScheduleLottery = async () => {
  const url = BACKEND_ROUTES.schedule_lottery.base;

  const res = await fetch(url, {
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
  });

  if (!res.ok) throw new Error('Error fetching results');
  const { data } = await res.json();

  return data.scheduleLotteries;
};

export const useScheduleLottery = () => {
  return useQuery<IScheduleLotteryEntityFront>({
    queryKey: ['schedule-lottery'],
    queryFn: () => fetchScheduleLottery(),
    staleTime: 12 * 60 * 60 * 1000, // 12 horas sin refetch por foco/mount
    gcTime: 60 * 60 * 1000, // 60 minutos en caché aunque no haya subscriptores
    refetchOnWindowFocus: false,
    refetchOnReconnect: true,
    refetchOnMount: false,
    retry: 1,
  });
};
