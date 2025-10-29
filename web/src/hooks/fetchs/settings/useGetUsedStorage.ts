import { useQuery } from '@tanstack/react-query';
import { BACKEND_ROUTES } from '../../../../routes/routes';

const fetchUsedStorage = async () => {
  const res = await fetch(`${BACKEND_ROUTES.settings.storage}`, {
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
  });
  if (!res.ok) throw new Error('Error fetching storage');
  return await res.json().then((res) => res.data.storage);
};

export const useGetUsedStorage = () =>
  useQuery<number>({
    queryKey: ['storageStatus'],
    queryFn: () => fetchUsedStorage(),
    staleTime: 3 * 60 * 60 * 1000, // 12 horas sin refetch por foco/mount
    gcTime: 60 * 60 * 1000, // 60 minutos en caché aunque no haya subscriptores
    refetchOnWindowFocus: false,
    refetchOnReconnect: true,
    refetchOnMount: false,
    retry: 1,
  });
