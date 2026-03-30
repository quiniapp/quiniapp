import { useQuery } from '@tanstack/react-query';
import { BACKEND_ROUTES } from '../../../../routes/routes';
import { FetchBetsProps, betsKey } from './useBets';
import { fetchWithAuth } from '@/lib/fetchWithAuth'; // donde definiste FetchBetsProps y betsKey

// ---------- keys (incluyen TODOS los filtros como en betsKey) ----------
export const totalAmountKey = (p: FetchBetsProps) =>
  ['bets-total-amount', ...betsKey(p)] as const;

export const totalPrizeKey = (p: FetchBetsProps) =>
  ['bets-total-prize', ...betsKey(p)] as const;

// ---------- @helpers comunes ----------
function buildSearchParams(p: FetchBetsProps) {
  const params = new URLSearchParams();
  if (p.date) params.set('date', p.date);
  if (p.schedule_id) params.set('schedule_id', p.schedule_id);
  if (p.lottery_id) params.set('lottery_id', p.lottery_id);
  if (p.cashier_id) params.set('cashier_id', p.cashier_id);
  if (p.grouped) params.set('grouped', p.grouped);
  if (p.winners) params.set('winners', p.winners); // 'true' | 'false'
  if (p.group_id) params.set('group_id', p.group_id);
  return params;
}

async function fetchNumberFrom(url: string, params: URLSearchParams): Promise<number> {
  const res = await fetchWithAuth(`${url}?${params.toString()}`, {
    headers: { 'Content-Type': 'application/json' },
  });
  if (!res.ok) throw new Error(`Error fetching ${url}`);
  const json = await res.json();
  // Ajustá a tu shape real. Opciones típicas:
  // - { data: { total: number } }
  // - { total: number }
  // - número plano
  if (typeof json === 'number') return json;
  if (typeof json?.data === 'number') return json.data;
  if (typeof json?.data?.total === 'number') return json.data.total;
  if (typeof json?.total === 'number') return json.total;
  // fallback seguro
  return Number(json) || 0;
}

// ---------- fetchers ----------
export async function fetchTotalAmount(p: FetchBetsProps): Promise<number> {
  if (!p.date) return 0;
  const params = buildSearchParams(p);
  return fetchNumberFrom(BACKEND_ROUTES.bet.totalAmount, params);
}

export async function fetchTotalPrize(p: FetchBetsProps): Promise<number> {
  if (!p.date) return 0;
  const params = buildSearchParams(p);
  return fetchNumberFrom(BACKEND_ROUTES.bet.totalPrize, params);
}

// ---------- hooks ----------
export function useTotalAmount(p: FetchBetsProps) {
  return useQuery<number>({
    queryKey: totalAmountKey(p),
    queryFn: () => fetchTotalAmount(p),
    enabled: Boolean(p.date),
  });
}

export function useTotalPrize(p: FetchBetsProps) {
  return useQuery<number>({
    queryKey: totalPrizeKey(p),
    queryFn: () => fetchTotalPrize(p),
    enabled: Boolean(p.date),
    staleTime: 5 * 60 * 1000,
    refetchOnWindowFocus: false,
  });
}
