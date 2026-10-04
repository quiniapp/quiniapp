import { useMutation, useQueryClient } from '@tanstack/react-query';
import { BACKEND_ROUTES } from '../../../../routes/routes';
import { fetchWithAuth } from '@/lib/fetchWithAuth';

interface ICleanupBatchResult {
  bets_deleted: number;
  tickets_deleted: number;
  done: boolean;
}

export interface ICleanupResult {
  bets_deleted: number;
  tickets_deleted: number;
}

// Un lote que tarda más que el proxy vuelve 502 aunque el backend lo termine;
// borrar es idempotente, así que se reintenta antes de cortar.
const MAX_CONSECUTIVE_FAILURES = 3;

const cleanupBatch = async (): Promise<ICleanupBatchResult> => {
  const res = await fetchWithAuth(BACKEND_ROUTES.settings.cleanup, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
  });

  if (!res.ok) {
    const errorText = await res.text();
    throw new Error(`Error limpiando datos: ${errorText}`);
  }

  const json = await res.json();
  return json.data as ICleanupBatchResult;
};

/** El backend borra un lote por request; se repite hasta que avisa `done`. */
const cleanupOldData = async (onProgress?: (total: ICleanupResult) => void) => {
  const total: ICleanupResult = { bets_deleted: 0, tickets_deleted: 0 };
  let failures = 0;

  for (;;) {
    let batch: ICleanupBatchResult;
    try {
      batch = await cleanupBatch();
      failures = 0;
    } catch (err) {
      failures += 1;
      if (failures >= MAX_CONSECUTIVE_FAILURES) throw err;
      continue;
    }

    total.bets_deleted += batch.bets_deleted;
    total.tickets_deleted += batch.tickets_deleted;
    onProgress?.({ ...total });

    if (batch.done) return total;
  }
};

export const useCleanupOldData = (onProgress?: (total: ICleanupResult) => void) => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: () => cleanupOldData(onProgress),
    onSettled: () => {
      // También si falla a mitad: los lotes ya borrados cambiaron el tamaño.
      queryClient.invalidateQueries({ queryKey: ['storageStatus'] });
    },
  });
};
