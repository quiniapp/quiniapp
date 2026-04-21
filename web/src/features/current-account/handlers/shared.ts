import { QueryClient } from '@tanstack/react-query';
import { currentAccountKey, fetchCurrentAccount } from '@/hooks/fetchs/current-account/useGetCurrentAccount';
import { betsKey, fetchBets } from '@/hooks/fetchs/plays/useBets';
import type { ICurrentAccountEntityFront } from '@helper/types/current_account.type';
import type { IBetEntityFront } from '@helper/types/bet.type';

export async function fetchCurrentAccountData(
  queryClient: QueryClient,
  date: string | null
): Promise<ICurrentAccountEntityFront[]> {
  return queryClient.fetchQuery({
    queryKey: currentAccountKey(date),
    queryFn: () => fetchCurrentAccount(date),
  });
}

export async function fetchWinningBetsForAccount(
  queryClient: QueryClient,
  account: ICurrentAccountEntityFront
): Promise<IBetEntityFront[]> {
  return queryClient.fetchQuery({
    queryKey: betsKey({ date: account.date, cashier_id: account.user_id, winners: 'true' }),
    queryFn: () => fetchBets({ date: account.date, cashier_id: account.user_id, winners: 'true' }),
  });
}
