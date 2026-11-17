import { useQuery } from '@tanstack/react-query';
import { IBetEntityFront } from '@helper/types/bet.type.ts';
import { ALL_PAGES_SIZE, fetchAllPages } from '@/lib/fetchAllPages';
import { fetchPaginatedBets } from './useInfiniteBets';

/** Filtros del listado de jugadas en modo lista (no agrupado). */
export interface FetchBetsProps {
  lottery_id?: string | null;
  schedule_id?: string | null;
  date: string | null;
  cashier_id?: string | null;
  winners?: string | null; // 'true' | 'false'
  tern?: string | null;
  quatern?: string | null;
  ticket_number?: string | null;
  group_id?: string | null;
  min_amount?: number | null;
}

// ⬇️ Incluir TODOS los filtros en el key (con fallback a '')
export const betsKey = (p: FetchBetsProps) =>
  [
    'bets',
    p.date ?? '',
    p.cashier_id ?? '',
    p.schedule_id ?? '',
    p.lottery_id ?? '',
    p.winners ?? '',
    p.quatern ?? '',
    p.tern ?? '',
    p.ticket_number ?? '',
    p.group_id ?? '',
    p.min_amount ?? '',
  ] as const;

/**
 * Todas las jugadas del filtro (recorre las páginas hasta el final): la cuenta
 * corriente y el PDF de liquidación necesitan el total, no la primera página.
 */
export async function fetchBets(props: FetchBetsProps): Promise<IBetEntityFront[]> {
  if (!props.date) return [];
  return fetchAllPages((cursor) =>
    fetchPaginatedBets({ ...props, grouped: null, limit: ALL_PAGES_SIZE }, cursor)
  );
}

export const useBets = (p: FetchBetsProps) => {
  return useQuery<IBetEntityFront[]>({
    queryKey: betsKey(p),
    queryFn: () => fetchBets(p),
    enabled: Boolean(p.date), // sólo si hay fecha
  });
};
