/** Prefijos de las consultas que muestra la cuenta corriente. */
export const CURRENT_ACCOUNT_QUERY_PREFIXES: readonly string[] = [
  'edition-account',
  'polla-current-accounts',
  'polla-group-accounts',
  'polla-bets',
  'polla-expenses',
  'polla-editions',
];

export const isCurrentAccountQuery = (queryKey: readonly unknown[]): boolean =>
  typeof queryKey[0] === 'string' && CURRENT_ACCOUNT_QUERY_PREFIXES.includes(queryKey[0]);
