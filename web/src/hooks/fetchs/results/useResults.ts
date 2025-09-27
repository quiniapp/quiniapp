import { useQuery } from '@tanstack/react-query';
import { BACKEND_ROUTES } from '../../../../routes/routes.ts';
import { IGetResultsEntity } from '../../../../helper/request/results.response.ts';

const fetchResults = async ({ lottery_id, schedule_id, date }: IGetResultsEntity) => {
  const url = `${BACKEND_ROUTES.results.base}?date=${date}&schedule_id=${schedule_id}&lottery_id=${lottery_id}`;

  const res = await fetch(url, {
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
  });

  if (!res.ok) throw new Error('Error fetching results');
  const { data } = await res.json();

  return data.results;
};

export const useResults = (params: IGetResultsEntity) => {
  const { lottery_id, schedule_id, date } = params;

  return useQuery({
    queryKey: ['results', params],
    queryFn: () => fetchResults(params),
    
    enabled: Boolean(lottery_id && schedule_id && date), // ⛔ evita que se ejecute con datos incompletos
  });
};
