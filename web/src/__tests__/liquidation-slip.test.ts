import { describe, expect, it } from 'vitest';
import { hasAccountMovement } from '@/lib/liquidationSlip';

const zero = {
  pass: 0,
  successes: 0,
  claims: 0,
  subtotal: 0,
  previous_balance: 0,
  collections: 0,
  paid: 0,
  total: 0,
  leave: 0,
  cashier_commission: 0,
  revenue: 0,
  bills: 0,
};

describe('hasAccountMovement (QuiniApp)', () => {
  it('todos los montos de la hoja en 0: sin movimiento (viene sin tildar)', () => {
    expect(hasAccountMovement(zero)).toBe(false);
  });

  it('cualquier monto de la hoja distinto de 0 (también negativo): con movimiento (viene tildado)', () => {
    for (const key of Object.keys(zero)) {
      expect(hasAccountMovement({ ...zero, [key]: 150 })).toBe(true);
      expect(hasAccountMovement({ ...zero, [key]: -150 })).toBe(true);
    }
  });

  it('null, undefined y "0" cuentan como 0', () => {
    expect(
      hasAccountMovement({
        ...zero,
        pass: null,
        total: undefined,
        paid: '0',
      } as unknown as typeof zero)
    ).toBe(false);
  });
});
