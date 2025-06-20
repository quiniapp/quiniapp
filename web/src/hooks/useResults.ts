import { useQuery } from '@tanstack/react-query';
import { ROUTES } from '../../routes/routes.ts';

const fetchResults = async () => {
  const res = await fetch(ROUTES.results.base, {
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
  });
  if (!res.ok) throw new Error('Error fetching results');
  return res.json();
}
export const useResults = () => useQuery({ queryKey: ['results'], queryFn: fetchResults });


