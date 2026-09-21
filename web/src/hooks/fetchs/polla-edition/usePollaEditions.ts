import { useQuery } from '@tanstack/react-query';
import { BACKEND_ROUTES } from '../../../../routes/routes';
import { IPollaEditionEntityFront, POLLA_EDITION_STATUS } from '@helper/types/polla-edition.type';
import { fetchWithAuth } from '@/lib/fetchWithAuth';

interface UsePollaEditionsOptions {
  status?: POLLA_EDITION_STATUS;
}

const fetchPollaEditions = async (options?: UsePollaEditionsOptions) => {
  const params = new URLSearchParams();
  if (options?.status) params.append('status', options.status);

  const queryString = params.toString();
  const url = `${BACKEND_ROUTES.polla_edition.base}${queryString ? `?${queryString}` : ''}`;

  const res = await fetchWithAuth(url, {
    headers: { 'Content-Type': 'application/json' },
  });
  if (!res.ok) throw new Error('Error fetching polla editions');
  return await res.json().then((res) => res.data.edition);
};

export const usePollaEditions = (options?: UsePollaEditionsOptions) =>
  useQuery<IPollaEditionEntityFront[]>({
    queryKey: ['polla-editions', { status: options?.status }],
    queryFn: () => fetchPollaEditions(options),
    staleTime: 5 * 60 * 1000,
    gcTime: 30 * 60 * 1000,
    refetchOnWindowFocus: false,
    refetchOnReconnect: true,
    refetchOnMount: true,
    retry: 1,
  });
