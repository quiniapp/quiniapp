import { useQuery } from '@tanstack/react-query';
import { ROUTES } from '../../../../routes/routes.ts';
import { IBetEntityFront } from '../../../../../helper/types/bet.type.ts';
interface FetchBetsProps {
  lottery_id?: string | null;
  schedule_id?: string | null;
  date: string | null;
  cashier_id?: string | null;
}

const fetchBets = async ({ date, schedule_id, lottery_id, cashier_id }: FetchBetsProps):Promise<IBetEntityFront[]> => {
  if (!date) return [];
  const params = new URLSearchParams({ date });

  if (schedule_id) params.append('schedule_id', schedule_id);
  if (lottery_id) params.append('lottery_id', lottery_id);
  if (cashier_id) params.append('cashier_id', cashier_id);

  const url = `${ROUTES.bet.base}?${params.toString()}`;

  const res = await fetch(url, {
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
  });

  if (!res.ok) throw new Error('Error fetching results');
  const { data } = await res.json();
  return data.bets;
};

export const useBets = ({ schedule_id, date, lottery_id, cashier_id }: FetchBetsProps) => {
  return useQuery<IBetEntityFront[]>({
    queryKey: ['plays', { date, schedule_id, lottery_id, cashier_id }],
    queryFn: () => fetchBets({ schedule_id, date, lottery_id, cashier_id }),
    enabled: Boolean(date), // solo se ejecuta si `date` tiene valor
  });
};
