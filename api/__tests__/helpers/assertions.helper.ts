import { expect } from '@jest/globals';

/**
 * Verifica que un valor numérico esté dentro de un rango de tolerancia
 */
export function expectToBeClose(actual: number, expected: number, tolerance: number = 0.01) {
  const diff = Math.abs(actual - expected);
  expect(diff).toBeLessThanOrEqual(tolerance);
}

/**
 * Verifica el estado de un bet después de generate_winners
 */
export function assertBetWinner(bet: any, expectedHits: number, expectedPrize: number) {
  if (expectedHits > 0) {
    expect(bet.winner).toBe(true);
    expect(bet.hits).toBe(expectedHits);
    expectToBeClose(bet.prize, expectedPrize);
  } else {
    expect(bet.winner).toBe(false);
    expect(bet.hits).toBe(0);
    expect(bet.prize).toBe(0);
  }
}

/**
 * Verifica el estado de current account
 */
export function assertCurrentAccount(
  account: any,
  expected: {
    pass: number;
    successes: number;
    revenue: number;
    cashier_commission: number;
    drag?: number;
    leave?: number;
    total: number;
  }
) {
  expectToBeClose(account.pass, expected.pass);
  expectToBeClose(account.successes, expected.successes);
  expectToBeClose(account.revenue, expected.revenue);
  expectToBeClose(account.cashier_commission, expected.cashier_commission);

  if (expected.drag !== undefined) {
    expectToBeClose(account.drag, expected.drag);
  }

  if (expected.leave !== undefined) {
    expectToBeClose(account.leave, expected.leave);
  }

  expectToBeClose(account.total, expected.total);
}
