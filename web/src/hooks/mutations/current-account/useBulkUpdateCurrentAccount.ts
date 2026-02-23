import { useMutation, useQueryClient } from '@tanstack/react-query';
import { BACKEND_ROUTES } from '../../../../routes/routes';
import { fetchWithAuth } from '@/lib/fetchWithAuth';
import { editPayloadObject } from '@/components/modals/GenerateLiquitationModal';

type BulkVars = {
  updateCurrentAccount: Map<string, editPayloadObject>;
  date: string; // en formato DD-MM-YYYY
  leave?: boolean;
};

type BulkResult = {
  updated: unknown[]; // si tenés el tipo ICurrentAccountEntityFront, usalo acá
  failed: Array<{ id: string; error: string }>;
};

async function bulkUpdateCurrentAccount({
  updateCurrentAccount,
  date,
  leave,
}: BulkVars): Promise<BulkResult> {
  
  const url = `${BACKEND_ROUTES.current_account.bulk}?date=${encodeURIComponent(date)}${leave ? '&leave=true' : ''}`;
  const body = {
    updateCurrentAccount: Object.fromEntries(updateCurrentAccount), // { [id]: {claims, paid, collections} }
  };
  const res = await fetchWithAuth(url, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

  // 200 o 207 entran como ok, pero queremos ver si hubo fallos parciales
  const json = await res.json().catch(() => ({}) as any);
  if (!res.ok) {
    throw new Error(
      `Error updating current-account: ${typeof json === 'object' ? JSON.stringify(json) : await res.text()}`
    );
  }

  // El backend responde { data: { updated, failed } }
  const data = (json?.data ?? { updated: [], failed: [] }) as BulkResult;
  return data;
}

export const useBulkUpdateCurrentAccount = () => {
  const queryClient = useQueryClient();

  return useMutation<BulkResult, Error, BulkVars>({
    mutationKey: ['bulkUpdateCurrentAccount'],
    mutationFn: bulkUpdateCurrentAccount,
    onSuccess: () => {
      // refrescá la cc del día recalculada
      queryClient.invalidateQueries({ queryKey: ['getCurrentAccount'] });

      // si querés avisar de parciales:
      // if (data.failed.length) toast.error(`${data.failed.length} items fallaron`);
      // else toast.success('Actualizado y recalculado');
    },
  });
};
