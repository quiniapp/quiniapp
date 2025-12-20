import { useQuery } from '@tanstack/react-query';
import { BACKEND_ROUTES } from '../../../../routes/routes';
import { ILotteryEntityFront } from '@helper/types/lottery.type';
import { DayKey } from '@helper/types/schedule-lottery.type';

interface UseLotteriesOptions {
  all?: boolean;
  day?: DayKey;
  activeOnly?: boolean;
}

const fetchLotteries = async (options?: UseLotteriesOptions) => {
  const params = new URLSearchParams();

  if (options?.all) params.append('all', 'true');
  if (options?.day) params.append('day', options.day);
  if (options?.activeOnly) params.append('active_only', 'true');

  const queryString = params.toString();
  const url = `${BACKEND_ROUTES.lottery.base}${queryString ? `?${queryString}` : ''}`;

  const res = await fetch(url, {
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
  });
  if (!res.ok) throw new Error('Error fetching lotteries');
  return await res.json().then((res) => res.data.lottery);
};

export const useLotteries = (options?: UseLotteriesOptions) =>
  useQuery<ILotteryEntityFront[]>({
    queryKey: ['lotteries', {
      all: !!options?.all,
      day: options?.day,
      activeOnly: !!options?.activeOnly
    }],
    queryFn: () => fetchLotteries(options),
    staleTime: options?.day ? 5 * 60 * 1000 : 12 * 60 * 60 * 1000, // 5 min for day filter, 12h for all
    gcTime: 30 * 60 * 1000, // 30 minutes in cache
    refetchOnWindowFocus: false, // No automatic refetch, manual reload if needed
    refetchOnReconnect: true,
    refetchOnMount: true, // IMPORTANT: refetch after invalidations and on login
    retry: 1,
  });
