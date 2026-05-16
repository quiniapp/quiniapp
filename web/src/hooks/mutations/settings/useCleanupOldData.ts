import { useMutation, useQueryClient } from '@tanstack/react-query';
import { BACKEND_ROUTES } from '../../../../routes/routes';
import { fetchWithAuth } from '@/lib/fetchWithAuth';

interface ICleanupResult {
  bets_deleted: number;
  tickets_deleted: number;
}

const cleanupOldData = async (): Promise<ICleanupResult> => {
  const res = await fetchWithAuth(BACKEND_ROUTES.settings.cleanup, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
  });

  if (!res.ok) {
    const errorText = await res.text();
    throw new Error(`Error limpiando datos: ${errorText}`);
  }

  const json = await res.json();
  return json.data as ICleanupResult;
};

export const useCleanupOldData = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: cleanupOldData,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['storageStatus'] });
    },
  });
};
