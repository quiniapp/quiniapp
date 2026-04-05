import { useQuery } from '@tanstack/react-query';
import { BACKEND_ROUTES } from '../../routes/routes';
import { fetchWithAuth } from '@/lib/fetchWithAuth';

const fetchWinners = async () => {
  const res = await fetchWithAuth(BACKEND_ROUTES.winners.base, {
    headers: { 'Content-Type': 'application/json' },
  });
  if (!res.ok) throw new Error('Error fetching winners');
  return res.json();
};

export const useWinners = () => useQuery({ queryKey: ['winners'], queryFn: fetchWinners });
