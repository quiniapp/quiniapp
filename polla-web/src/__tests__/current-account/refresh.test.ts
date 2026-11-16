import { describe, expect, it } from 'vitest';
import { isCurrentAccountQuery } from '@/features/current-account/refresh';

describe('isCurrentAccountQuery', () => {
  it('incluye las consultas de la cuenta corriente', () => {
    expect(isCurrentAccountQuery(['edition-account', 'list'])).toBe(true);
    expect(isCurrentAccountQuery(['polla-current-accounts', 'day'])).toBe(true);
    expect(isCurrentAccountQuery(['polla-group-accounts'])).toBe(true);
    expect(isCurrentAccountQuery(['polla-bets'])).toBe(true);
    expect(isCurrentAccountQuery(['polla-expenses'])).toBe(true);
    expect(isCurrentAccountQuery(['polla-editions'])).toBe(true);
  });
  it('deja afuera las demás', () => {
    expect(isCurrentAccountQuery(['polla-lotteries'])).toBe(false);
    expect(isCurrentAccountQuery(['polla-prizes'])).toBe(false);
    expect(isCurrentAccountQuery([])).toBe(false);
  });
});
