import { useQuery } from '@tanstack/react-query';
import { BACKEND_ROUTES } from '../../../../routes/routes';
import { IScheduleEntityFront } from '@helper/types/schedule.type';


const fetchSchedules = async (all?:boolean) => {
  const res = await fetch(`${BACKEND_ROUTES.schedule.base}${all?'?all=true':''}`, {
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
  });
  if (!res.ok) throw new Error('Error fetching schedules');
  return await res.json().then((res) => res.data.schedule);
};

export const useSchedules = (all?:boolean) =>
  useQuery<IScheduleEntityFront[]>({
    queryKey: ['schedules', { all: !!all }], // Fixed: include 'all' param for proper cache segregation
    queryFn: ()=> fetchSchedules(all),
    staleTime: 12 * 60 * 60 * 1000, // 12 hours - changes are infrequent, users can refresh if needed
    gcTime: 30 * 60 * 1000, // 30 minutes in cache
    refetchOnWindowFocus: false, // No automatic refetch, manual reload if needed
    refetchOnReconnect: true,
    refetchOnMount: true, // IMPORTANT: refetch after invalidations and on login
    retry: 1,
  });
