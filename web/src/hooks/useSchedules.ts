import { useQuery } from '@tanstack/react-query';
import { ROUTES } from '../../routes/routes';
import { IScheduleEntityFront } from '../../../helper/types/schedule.type';

const fetchSchedules = async () => {
  const res = await fetch(ROUTES.schedule.base, {
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
  });
  if (!res.ok) throw new Error('Error fetching schedules');
  return await res.json().then((res) => res.data.schedule);
};

export const useSchedules = () =>
  useQuery<IScheduleEntityFront[]>({ queryKey: ['schedules'], queryFn: fetchSchedules });
