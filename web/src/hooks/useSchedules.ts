import { useQuery } from '@tanstack/react-query';
import { ROUTES } from '../../routes/routes';

const fetchSchedules = async () => {
  const res = await fetch(ROUTES.schedule.base, {
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
  });
  if (!res.ok) throw new Error('Error fetching schedules');
  return res.json();
};

export const useSchedules = () =>
  useQuery({ queryKey: ['schedules'], queryFn: fetchSchedules });
