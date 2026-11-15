import { describe, expect, it } from 'vitest';
import { IPollaEditionAccountRow } from '@helper/polla/types/game.type';
import { generateEditionLiquidationSchema } from '@helper/polla/schemas/game.schema';
import { parseAmount, withNewMovements } from '@/lib/editionAccount';

const uuid = (n: number) => `00000000-0000-0000-0000-${String(n).padStart(12, '0')}`;

/**
 * Fila como la arma `polla_edition_account_base`: 300 de pase de jugadas, 100
 * de borradas, un reclamo de +20 y otro de −5, comisión del 10%, cobro de 50 y
 * pago de 10. pass = 300 − 100 + 20 = 220; comisión 22; subtotal 220 − 22 − 5 =
 * 193; total 193 − 50 + 10 = 153.
 */
const row = (overrides: Partial<IPollaEditionAccountRow> = {}): IPollaEditionAccountRow => ({
  polla_user_id: uuid(1),
  user_name: 'Pasador',
  user_number: 1,
  polla_group_id: null,
  fee: 10,
  bets_pass: 300,
  deleted_pass: 100,
  claims: 15,
  pass: 220,
  cashier_commission: 22,
  subtotal: 193,
  revenue: 193,
  collections: 50,
  paid: 10,
  total: 153,
  live_bets_pass: 300,
  live_deleted_pass: 100,
  live_fee: 10,
  differs: false,
  liquidation: null,
  ...overrides,
});

describe('withNewMovements: el Debe con lo que se suma hoy (misma fórmula que la base)', () => {
  it('sin nada nuevo queda igual', () => {
    const view = withNewMovements(row(), { claim: 0, collection: 0, payment: 0 });
    expect([view.pass, view.cashier_commission, view.subtotal, view.total]).toEqual([
      220, 22, 193, 153,
    ]);
  });

  it('un cobro resta y un pago suma, sin tocar el pase', () => {
    const view = withNewMovements(row(), { claim: 0, collection: 100, payment: 30 });
    expect(view.collections).toBe(150);
    expect(view.paid).toBe(40);
    expect(view.pass).toBe(220);
    expect(view.total).toBe(83);
  });

  it('un reclamo positivo suma al pase y a la comisión', () => {
    // pass 230; comisión 23; subtotal 230 − 23 − 5 = 202; total 202 − 50 + 10 = 162.
    const view = withNewMovements(row(), { claim: 10, collection: 0, payment: 0 });
    expect([view.claims, view.pass, view.cashier_commission, view.subtotal, view.total]).toEqual([
      25, 230, 23, 202, 162,
    ]);
  });

  it('un reclamo negativo resta del subtotal, no del pase', () => {
    const view = withNewMovements(row(), { claim: -20, collection: 0, payment: 0 });
    expect([view.claims, view.pass, view.cashier_commission, view.subtotal, view.total]).toEqual([
      -5, 220, 22, 173, 133,
    ]);
  });

  it('la comisión redondea a centavos como ROUND de Postgres', () => {
    // 0,05 × 10% = 0,005 → 0,01.
    const view = withNewMovements(
      row({
        bets_pass: 0,
        deleted_pass: 0,
        claims: 0,
        pass: 0,
        cashier_commission: 0,
        subtotal: 0,
      }),
      { claim: 0.05, collection: 0, payment: 0 }
    );
    expect(view.cashier_commission).toBe(0.01);
  });
});

describe('parseAmount', () => {
  it('acepta coma decimal y signo', () => {
    expect(parseAmount('1,5')).toBe(1.5);
    expect(parseAmount('-20')).toBe(-20);
  });
  it('vacío o texto es null', () => {
    expect(parseAmount('  ')).toBeNull();
    expect(parseAmount('abc')).toBeNull();
  });
});

describe('generateEditionLiquidationSchema', () => {
  it('acepta pasadores con montos o sin ellos', () => {
    const parsed = generateEditionLiquidationSchema.safeParse({
      entries: [{ polla_user_id: uuid(1), collection: 10, claim: -5 }, { polla_user_id: uuid(2) }],
      ticket_source: 'NEW',
    });
    expect(parsed.success).toBe(true);
  });
  it('sin pasadores no', () =>
    expect(generateEditionLiquidationSchema.safeParse({ entries: [] }).success).toBe(false));
  it('un cobro o un pago negativo no', () => {
    expect(
      generateEditionLiquidationSchema.safeParse({
        entries: [{ polla_user_id: uuid(1), collection: -1 }],
      }).success
    ).toBe(false);
    expect(
      generateEditionLiquidationSchema.safeParse({
        entries: [{ polla_user_id: uuid(1), payment: -1 }],
      }).success
    ).toBe(false);
  });
  it('un pasador repetido no', () =>
    expect(
      generateEditionLiquidationSchema.safeParse({
        entries: [{ polla_user_id: uuid(1) }, { polla_user_id: uuid(1) }],
      }).success
    ).toBe(false));
});
