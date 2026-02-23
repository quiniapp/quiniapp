import { useQuery } from '@tanstack/react-query';
import { BACKEND_ROUTES } from '../../../../routes/routes';
import { IScheduleLotteryEntityFront } from '@helper/types/schedule-lottery.type';
import { fetchWithAuth } from '@/lib/fetchWithAuth';

const fetchScheduleLottery = async () => {
  const url = BACKEND_ROUTES.schedule_lottery.base;

  const res = await fetchWithAuth(url, {
    headers: { 'Content-Type': 'application/json' },
  });

  if (!res.ok) throw new Error('Error fetching results');
  const { data } = await res.json();

  return data.scheduleLotteries;
};

export const useScheduleLottery = () => {
  return useQuery<IScheduleLotteryEntityFront>({
    queryKey: ['schedule-lottery'],
    queryFn: () => fetchScheduleLottery(),
    staleTime: 12 * 60 * 60 * 1000, // 12 hours - changes are infrequent, users can refresh if needed
    gcTime: 60 * 60 * 1000, // 60 minutes in cache even without subscribers
    refetchOnWindowFocus: false,
    refetchOnReconnect: true,
    refetchOnMount: true, // Changed to true: refetch after invalidations and on login
    retry: 1,
  });
};
