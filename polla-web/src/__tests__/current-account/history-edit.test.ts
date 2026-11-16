import { describe, expect, it } from 'vitest';
import { IPollaCurrentAccountPeriodRow } from '@helper/polla/types/game.type';
import { pollaCurrentAccountPaymentsSchema } from '@helper/polla/schemas/game.schema';
import { dayBalanceAfter, dayPayments } from '@/lib/accountPeriod';

describe('pollaCurrentAccountPaymentsSchema', () => {
  it('acepta montos de 0 o más con hasta 2 decimales', () => {
    expect(
      pollaCurrentAccountPaymentsSchema.safeParse({ collections: 0, paid: 150.5 }).success
    ).toBe(true);
    // 0.29 * 100 da 28.999999999999996 en coma flotante: igual son 2 decimales.
    expect(
      pollaCurrentAccountPaymentsSchema.safeParse({ collections: 0.29, paid: 1.13 }).success
    ).toBe(true);
  });
  it('rechaza negativos, más de 2 decimales y vacíos', () => {
    expect(pollaCurrentAccountPaymentsSchema.safeParse({ collections: -1, paid: 0 }).success).toBe(
      false
    );
    expect(
      pollaCurrentAccountPaymentsSchema.safeParse({ collections: 0, paid: -0.01 }).success
    ).toBe(false);
    expect(
      pollaCurrentAccountPaymentsSchema.safeParse({ collections: 1.234, paid: 0 }).success
    ).toBe(false);
    expect(pollaCurrentAccountPaymentsSchema.safeParse({ collections: 10 }).success).toBe(false);
    expect(
      pollaCurrentAccountPaymentsSchema.safeParse({ collections: Number.NaN, paid: 0 }).success
    ).toBe(false);
  });
  it('rechaza montos más grandes que NUMERIC(12,2), con el mensaje del máximo', () => {
    expect(
      pollaCurrentAccountPaymentsSchema.safeParse({ collections: 9999999999.99, paid: 0 }).success
    ).toBe(true);
    const tooBig = pollaCurrentAccountPaymentsSchema.safeParse({
      collections: 10000000000,
      paid: 0,
    });
    expect(tooBig.success).toBe(false);
    expect(tooBig.error?.issues[0]?.message).toBe('El monto es demasiado grande');
    // `1e21` se escribe "1e+21": el primer error es el del máximo, no el de los decimales.
    const huge = pollaCurrentAccountPaymentsSchema.safeParse({ collections: 0, paid: 1e21 });
    expect(huge.error?.issues[0]?.message).toBe('El monto es demasiado grande');
  });
});

describe('dayBalanceAfter', () => {
  const row = {
    collections: 0,
    paid: 0,
    total: 12000,
  } as unknown as IPollaCurrentAccountPeriodRow;
  it('un cobro nuevo baja el saldo del día', () =>
    expect(dayBalanceAfter(row, { collections: 5000, paid: 0 })).toBe(7000));
  it('un pago nuevo lo sube', () =>
    expect(dayBalanceAfter(row, { collections: 0, paid: 300 })).toBe(12300));
  it('editar un cobro de 1000 a 1500 lo baja 500', () => {
    const withCollection = {
      collections: '1000',
      paid: '0',
      total: '11000',
    } as unknown as IPollaCurrentAccountPeriodRow;
    expect(dayBalanceAfter(withCollection, { collections: 1500, paid: 0 })).toBe(10500);
  });
  it('sin cambios queda igual, sin errores de coma flotante', () => {
    const cents = {
      collections: 0.1,
      paid: 0.2,
      total: 0.3,
    } as unknown as IPollaCurrentAccountPeriodRow;
    expect(dayBalanceAfter(cents, { collections: 0.1, paid: 0.2 })).toBe(0.3);
    expect(dayBalanceAfter(cents, { collections: 0.3, paid: 0.2 })).toBe(0.1);
  });
});

describe('dayPayments', () => {
  it('usa los cobros y pagos del día, no los acumulados del período', () => {
    const row = {
      collections: 100,
      paid: 20,
      total: 1500,
      period: { from: '2026-03-02', collections: 900, paid: 300, total: 1500 },
    } as unknown as IPollaCurrentAccountPeriodRow;
    expect(dayPayments(row)).toEqual({ collections: 100, paid: 20 });
  });
  it('convierte a número lo que llega como texto', () => {
    const row = {
      collections: '100.50',
      paid: '0',
      period: { collections: '900', paid: '300' },
    } as unknown as IPollaCurrentAccountPeriodRow;
    expect(dayPayments(row)).toEqual({ collections: 100.5, paid: 0 });
  });
});
