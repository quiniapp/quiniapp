import { useQuery } from '@tanstack/react-query';
import { ROUTES } from '../../../../routes/routes.ts';
import { IGetResultsEntity } from '../../../../helper/request/results.response.ts';

const fetchResults = async ({ lottery_id, schedule_id, date }: IGetResultsEntity) => {
  if (!lottery_id || !schedule_id) return [];
  const url = `${ROUTES.results.base}?date=${date}&schedule_id=${schedule_id}&lottery_id=${lottery_id}`;

  const res = await fetch(url, {
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
  });

  if (!res.ok) throw new Error('Error fetching results');
  return res.json();
};

export const useResults = (params: IGetResultsEntity) =>
  useQuery({
    queryKey: ['results', params],
    queryFn: () => fetchResults(params),
  });
