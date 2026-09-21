import { useQuery } from '@tanstack/react-query';
import { BACKEND_ROUTES } from '../../../../routes/routes';
import { IPollaBetEntityFront } from '@helper/types/polla-bet.type';
import { fetchWithAuth } from '@/lib/fetchWithAuth';

interface UsePollaBetsOptions {
  polla_edition_id?: string;
  lottery_id?: string;
  schedule_id?: string;
  date?: string;
  cashier_id?: string;
  ticket_number?: string;
  enabled?: boolean;
}

const fetchPollaBets = async (options?: UsePollaBetsOptions) => {
  const params = new URLSearchParams();
  if (options?.polla_edition_id) params.append('polla_edition_id', options.polla_edition_id);
  if (options?.lottery_id) params.append('lottery_id', options.lottery_id);
  if (options?.schedule_id) params.append('schedule_id', options.schedule_id);
  if (options?.date) params.append('date', options.date);
  if (options?.cashier_id) params.append('cashier_id', options.cashier_id);
  if (options?.ticket_number) params.append('ticket_number', options.ticket_number);

  const queryString = params.toString();
  const url = `${BACKEND_ROUTES.polla_bet.base}${queryString ? `?${queryString}` : ''}`;

  const res = await fetchWithAuth(url, {
    headers: { 'Content-Type': 'application/json' },
  });
  if (!res.ok) throw new Error('Error fetching polla bets');
  return await res.json().then((res) => res.data.bet);
};

export const usePollaBets = (options?: UsePollaBetsOptions) =>
  useQuery<IPollaBetEntityFront[]>({
    queryKey: [
      'polla-bets',
      {
        polla_edition_id: options?.polla_edition_id,
        lottery_id: options?.lottery_id,
        schedule_id: options?.schedule_id,
        date: options?.date,
        cashier_id: options?.cashier_id,
        ticket_number: options?.ticket_number,
      },
    ],
    queryFn: () => fetchPollaBets(options),
    enabled: options?.enabled ?? true,
    staleTime: 60 * 1000,
    gcTime: 10 * 60 * 1000,
    refetchOnWindowFocus: false,
    refetchOnMount: true,
    retry: 1,
  });
