import { useQuery } from '@tanstack/react-query';
import { BACKEND_ROUTES } from '../../../../routes/routes';
import { IScheduleEntityFront } from '@helper/types/schedule.type';

const fetchSchedules = async () => {
  const res = await fetch(BACKEND_ROUTES.schedule.base, {
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
    staleTime: 5 * 60 * 1000, // 5 minutos - tiempo razonable para refetch
    gcTime: 30 * 60 * 1000, // 30 minutos en caché
    refetchOnWindowFocus: true, // Refetch cuando vuelve al tab
    refetchOnReconnect: true,
    refetchOnMount: true, // IMPORTANTE: refetch después de invalidaciones
    retry: 1,
  });
