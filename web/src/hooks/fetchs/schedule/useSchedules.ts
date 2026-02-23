import { useQuery } from '@tanstack/react-query';
import { BACKEND_ROUTES } from '../../../../routes/routes';
import { IScheduleEntityFront } from '@helper/types/schedule.type';
import { DayKey } from '@helper/types/schedule-lottery.type';
import { fetchWithAuth } from '@/lib/fetchWithAuth';

interface UseSchedulesOptions {
  all?: boolean;
  day?: DayKey;
  withLotteries?: boolean;
}

const fetchSchedules = async (options?: UseSchedulesOptions) => {
  const params = new URLSearchParams();

  if (options?.all) params.append('all', 'true');
  if (options?.day) params.append('day', options.day);
  if (options?.withLotteries) params.append('with_lotteries', 'true');

  const queryString = params.toString();
  const url = `${BACKEND_ROUTES.schedule.base}${queryString ? `?${queryString}` : ''}`;

  const res = await fetchWithAuth(url, {
    headers: { 'Content-Type': 'application/json' },
  });
  if (!res.ok) throw new Error('Error fetching schedules');
  return await res.json().then((res) => res.data.schedule);
};

export const useSchedules = (options?: UseSchedulesOptions) =>
  useQuery<IScheduleEntityFront[]>({
    queryKey: ['schedules', {
      all: !!options?.all,
      day: options?.day,
      withLotteries: !!options?.withLotteries
    }],
    queryFn: () => fetchSchedules(options),
    staleTime: options?.day ? 5 * 60 * 1000 : 12 * 60 * 60 * 1000, // 5 min for day filter, 12h for all
    gcTime: 30 * 60 * 1000, // 30 minutes in cache
    refetchOnWindowFocus: false, // No automatic refetch, manual reload if needed
    refetchOnReconnect: true,
    refetchOnMount: true, // IMPORTANT: refetch after invalidations and on login
    retry: 1,
  });
