import { useQuery } from '@tanstack/react-query';
import { BACKEND_ROUTES } from '../../../../routes/routes.ts';
import { IBetEntityFront } from '@helper/types/bet.type.ts';
import { betsKey, FetchBetsProps } from './useBets.ts';

// ⬇️ Exportá el fetch para usarlo fuera del hook
export async function fetchBetsByTicketNumber({
  date,
  schedule_id,
  lottery_id,
  cashier_id,
  grouped,
  winners,
  quatern,
  tern,
  ticket_number,
}: FetchBetsProps): Promise<IBetEntityFront[]> {
  if (!date) return [];

  const params = new URLSearchParams({ date });
  if (schedule_id) params.append('schedule_id', schedule_id);
  if (lottery_id) params.append('lottery_id', lottery_id);
  if (cashier_id) params.append('cashier_id', cashier_id);
  if (grouped) params.append('grouped', grouped);
  if (winners) params.append('winners', winners);
  if (quatern) params.append('quatern', quatern);
  if (tern) params.append('tern', tern);
  if (ticket_number) params.append('ticket_number', ticket_number);

  const url = `${BACKEND_ROUTES.bet.base}?${params.toString()}`;
  const res = await fetch(url, {
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
  });

  if (!res.ok) throw new Error('Error fetching bets');

  // ajustá a tu shape real
  const json = await res.json();
  return json?.data?.bets ?? [];
}

export const useGetBetysByTicketNumber = (p: FetchBetsProps) => {
  return useQuery<IBetEntityFront[]>({
    queryKey: betsKey(p),
    queryFn: () => fetchBetsByTicketNumber(p),
    enabled: Boolean(p.date && p.ticket_number), // sólo si hay fecha
  });
};
