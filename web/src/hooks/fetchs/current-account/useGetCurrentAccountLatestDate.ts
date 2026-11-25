import { useQuery } from '@tanstack/react-query';
import { BACKEND_ROUTES } from '../../../../routes/routes.ts';
import { fetchWithAuth } from '@/lib/fetchWithAuth';

type ApiResponse = { data?: { date?: string | null } };

async function fetchLatestDate(): Promise<string | null> {
  const res = await fetchWithAuth(BACKEND_ROUTES.current_account.latest_date, {
    headers: { 'Content-Type': 'application/json' },
  });
  if (!res.ok) throw new Error('Error fetching latest current account date');

  const json: ApiResponse = await res.json();
  return json?.data?.date ?? null;
}

export function useGetCurrentAccountLatestDate(enabled: boolean) {
  return useQuery<string | null>({
    queryKey: ['currentAccountLatestDate'],
    queryFn: fetchLatestDate,
    enabled,
    // Sin cache entre montajes: liquidar o actualizar crea una fecha nueva y una copia vieja
    // se escribiría en la URL antes del refetch.
    gcTime: 0,
    staleTime: 0,
    retry: 1,
  });
}
