import { describe, expect, it } from 'vitest';
// La hoja de liquidación de QuiniApp (web/); web no tiene tests propios, así que se prueba acá.
import { hasLiquidationAmounts } from '../../../../web/src/lib/liquidationSlip';

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

describe('hasLiquidationAmounts (QuiniApp)', () => {
  it('todos los montos de la hoja en 0: no se exporta', () => {
    expect(hasLiquidationAmounts(zero)).toBe(false);
  });

  it('cualquier monto de la hoja distinto de 0 (también negativo): se exporta', () => {
    for (const key of Object.keys(zero)) {
      expect(hasLiquidationAmounts({ ...zero, [key]: 150 })).toBe(true);
      expect(hasLiquidationAmounts({ ...zero, [key]: -150 })).toBe(true);
    }
  });

  it('null, undefined y "0" cuentan como 0', () => {
    expect(
      hasLiquidationAmounts({
        ...zero,
        pass: null,
        total: undefined,
        paid: '0',
      } as unknown as typeof zero)
    ).toBe(false);
  });
});
