import { useQuery } from '@tanstack/react-query';
import { ROUTES } from '../../../../routes/routes.ts';
import {ICurrentAccountEntityFront } from '../../../../../helper/types/current_account.type.ts'
const fetchResults = async ( date : string) => {
  const url = `${ROUTES.current_account.base}?date=${date}`;

  const res = await fetch(url, {
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
  });

  if (!res.ok) throw new Error('Error fetching results');
  const { data } = await res.json();

  return data.currentAccount;
};

export const useGetCurrentAccount = (date : string) => {

  return useQuery<ICurrentAccountEntityFront[]>({
    queryKey: ['getCurrentAccount', date],
    queryFn: () => fetchResults(date),
    enabled: Boolean(date), // ⛔ evita que se ejecute con datos incompletos
  });
};
