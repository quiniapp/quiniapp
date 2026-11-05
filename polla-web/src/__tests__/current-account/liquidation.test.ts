import { describe, expect, it } from 'vitest';
import { AccountPeriodView } from '@/lib/accountPeriod';
import { computeAccountTotals } from '@/functions/current-account/pdf-shared';
import {
  hasAccountMovement,
  liquidationFileName,
  liquidationSlipAmounts,
} from '@/functions/current-account/liquidationSlipPDF';

const ZERO = {
  bets_pass: 0,
  deleted_pass: 0,
  pass: 0,
  successes: 0,
  claims: 0,
  subtotal: 0,
  previous_balance: 0,
  collections: 0,
  paid: 0,
  cashier_commission: 0,
  bills: 0,
  revenue: 0,
  total: 0,
};

let next = 0;
const account = (amounts: Partial<typeof ZERO> = {}, extra: Partial<AccountPeriodView> = {}) =>
  ({
    polla_current_account_id: `acc-${++next}`,
    polla_user_id: `user-${next}`,
    user_name: `Pasador ${next}`,
    user_number: next,
    polla_group_id: null,
    date: '2026-11-07',
    period_from: '2026-11-02',
    ...ZERO,
    ...amounts,
    ...extra,
  }) as unknown as AccountPeriodView;

describe('hasAccountMovement', () => {
  it('con todo en 0 no tiene movimiento', () => {
    expect(hasAccountMovement(account())).toBe(false);
  });

  it.each([
    ['el pase jugadas', { bets_pass: 1000 }],
    ['las borradas', { deleted_pass: 500 }],
    ['el pase', { pass: 500 }],
    ['el saldo anterior', { previous_balance: -2500 }],
    ['los cobros', { collections: 300 }],
    ['los pagos', { paid: 300 }],
    ['el total (un premio sin pase)', { successes: 50000, total: -50000 }],
  ])('tiene movimiento con %s', (_label, amounts) => {
    expect(hasAccountMovement(account(amounts))).toBe(true);
  });
});

describe('liquidationFileName', () => {
  it('lleva la fecha, el nombre y grupo-número', () => {
    expect(liquidationFileName(account({}, { user_name: 'Pedro' }), '2-5')).toBe(
      'polla_Exportar_Liquidacion_07-11-2026_Pedro-2-5.pdf'
    );
  });

  it('sin número queda solo el nombre', () => {
    expect(liquidationFileName(account({}, { user_name: 'Pedro' }), '')).toBe(
      'polla_Exportar_Liquidacion_07-11-2026_Pedro.pdf'
    );
  });

  it('saca los caracteres que no admite un nombre de archivo', () => {
    expect(liquidationFileName(account({}, { user_name: 'Ana/Beto: "calle"' }), '1-3')).toBe(
      'polla_Exportar_Liquidacion_07-11-2026_Ana_Beto_ _calle_-1-3.pdf'
    );
  });
});

describe('hojas por pasador contra la liquidación general', () => {
  const accounts = [
    account({
      bets_pass: 12000,
      deleted_pass: 1000,
      pass: 11000,
      successes: 0,
      claims: 200,
      subtotal: 9350.5,
      previous_balance: 1500.25,
      collections: 5000,
      paid: 0,
      total: 5850.75,
    }),
    account({
      bets_pass: 3000,
      pass: 3000,
      successes: 50000,
      subtotal: -47450,
      previous_balance: -800,
      paid: 20000,
      total: -28250,
    }),
    account(),
    account({ previous_balance: 700, total: 700, subtotal: 0 }),
  ];
  const general = computeAccountTotals(accounts);
  const keys = Object.keys(general) as (keyof typeof general)[];

  it('los montos de las hojas suman lo mismo que la liquidación general', () => {
    for (const key of keys) {
      const sum = accounts.reduce((acc, item) => acc + liquidationSlipAmounts(item)[key], 0);
      expect(sum, key).toBeCloseTo(general[key], 2);
    }
  });

  it('dejar afuera a los que no tienen movimiento no cambia los totales', () => {
    const exported = accounts.filter(hasAccountMovement);
    expect(exported).toHaveLength(3);
    const totals = computeAccountTotals(exported);
    for (const key of keys) {
      expect(totals[key], key).toBeCloseTo(general[key], 2);
    }
  });
});
