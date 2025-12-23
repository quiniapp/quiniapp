import { useQuery } from '@tanstack/react-query';
import { BACKEND_ROUTES } from '../../../../routes/routes.ts';
import { TicketSums } from '@helper/request/bet.request';



export interface FetchAmountsProps {
  ticket_number?: string | null;
}

// ⬇️ Incluir TODOS los filtros en el key (con fallback a '')
export const betsKey = (p: FetchAmountsProps) =>
  [
    'amounts_by_ticket_number',
    p.ticket_number ?? '',
  ] as const;
// ⬇️ Exportá el fetch para usarlo fuera del hook
export async function fetchAmountsByTicketNumber({
  ticket_number,
}: FetchAmountsProps): Promise<TicketSums> {
  if (!ticket_number)
    return { total_amount: 0, total_prize: 0, total_count: 0, total_winners_count: 0 };

  const params = new URLSearchParams({ ticket_number });

  const url = `${BACKEND_ROUTES.bet.amounts}?${params.toString()}`;
  const res = await fetch(url, {
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
  });

  if (!res.ok) throw new Error('Error fetching bets');

  // ajustá a tu shape real
  const json = await res.json();
  // Con paginación, la estructura es: json.data.bets.data
  return (
    json?.data?.total ?? {
      total_amount: 0,
      total_prize: 0,
      total_count: 0,
      total_winners_count: 0,
    }
  );
}

export const useGetAmountsByTicketNumber = (p: FetchAmountsProps) => {
  return useQuery<TicketSums>({
    queryKey: betsKey(p),
    queryFn: () => fetchAmountsByTicketNumber(p),
    enabled: Boolean( p.ticket_number), // sólo si hay fecha
  });
};
