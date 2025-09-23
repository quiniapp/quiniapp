import { useQuery } from '@tanstack/react-query';
import { ROUTES } from '../../../../routes/routes';
import { IScheduleEntityFront } from '../../../../../helper/types/schedule.type';

const fetchSchedules = async () => {
  const res = await fetch(ROUTES.schedule.base, {
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
  });
  if (!res.ok) throw new Error('Error fetching schedules');
  return await res.json().then((res) => res.data.schedule);
};

export const useSchedules = () =>
  useQuery<IScheduleEntityFront[]>({
    queryKey: ['schedules'],
    queryFn: fetchSchedules,
    staleTime: 12 * 60 * 60 * 1000, // 12 horas sin refetch por foco/mount
    gcTime: 60 * 60 * 1000, // 60 minutos en caché aunque no haya subscriptores
    refetchOnWindowFocus: false,
    refetchOnReconnect: true,
    refetchOnMount: false,
    retry: 1,
  });
