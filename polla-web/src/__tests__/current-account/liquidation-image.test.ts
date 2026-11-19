import { describe, expect, it } from 'vitest';
import { AccountPeriodView } from '@/lib/accountPeriod';
import { type GroupLiquidationSheet, groupLiquidationRows } from '@/lib/groupLiquidation';
import {
  cashierLiquidationImageLines,
  groupLiquidationImageLines,
} from '@/lib/liquidationImageLines';
import { looseFileNames } from '@/lib/liquidationZip';
import { liquidationSlipAmounts } from '@/lib/liquidationSlip';

const sheet: GroupLiquidationSheet = {
  account: {
    polla_group_id: 'g1',
    group_name: 'Leo',
    cashiers_subtotal: 120000,
    expenses: 5000,
    base: 115000,
    admin_percentage: 20,
    admin_commission: 23000,
    edited_at: '2026-11-15T21:30:00.000000+00:00',
  },
  group: { number: 1, name: 'Leo' },
  orgName: 'Org',
  editionTitle: 'Polla 15/11',
  date: '2026-11-15',
};

const account = (total: number, extra: Partial<AccountPeriodView> = {}) =>
  ({
    user_name: 'Laura',
    user_number: 6,
    date: '2026-11-15',
    period_from: '2026-11-09',
    bets_pass: 100000,
    deleted_pass: 20000,
    pass: 80000,
    claims: 10000,
    subtotal: 90000,
    previous_balance: 30000,
    collections: 40000,
    paid: 15000,
    cashier_commission: 12000,
    bills: 5000,
    revenue: 70000,
    total,
    ...extra,
  }) as unknown as AccountPeriodView;

describe('liquidaciones en imagen', () => {
  it('groupLiquidationImageLines: encabezado y los mismos renglones que la hoja', () => {
    const lines = groupLiquidationImageLines(sheet);
    expect(lines.slice(0, 4)).toEqual([
      { kind: 'title', text: 'ORG' },
      { kind: 'title', text: 'Grupo 1 - Leo' },
      { kind: 'text', text: 'Edición Polla 15/11' },
      { kind: 'text', text: '15/11/2026' },
    ]);
    expect(lines.filter((l) => l.kind === 'row')).toEqual(
      groupLiquidationRows(sheet.account).map((r) => ({
        kind: 'row',
        ...r,
        strong: ['Total', 'Total admin', 'Total capitalista'].includes(r.label),
      }))
    );
  });

  it('groupLiquidationImageLines: sin organización no hay título de organización', () => {
    const lines = groupLiquidationImageLines({ ...sheet, orgName: '' });
    expect(lines[0]).toEqual({ kind: 'title', text: 'Grupo 1 - Leo' });
    expect(lines.some((l) => l.kind === 'title' && l.text === '')).toBe(false);
  });

  it('cashierLiquidationImageLines: los montos de la hoja del pasador y Debe', () => {
    const acc = account(25000);
    const lines = cashierLiquidationImageLines({ account: acc, headerLabel: 'Polla 15/11' });
    expect(lines.slice(0, 2)).toEqual([
      { kind: 'title', text: 'Nro 6 · Laura' },
      { kind: 'text', text: 'Edición Polla 15/11' },
    ]);
    const rows = lines.filter((l) => l.kind === 'row');
    expect(rows.map((r) => r.label)).toEqual([
      'Pase jugadas',
      'Borradas',
      'Pase',
      'Comisión',
      'Reclamos',
      'Subtotal',
      'Saldo',
      'Cobré',
      'Pagué',
      'Gastos',
      'Deja',
      'Debe',
    ]);
    const a = liquidationSlipAmounts(acc);
    const fmt = (n: number) => `$${n.toLocaleString('es-AR', { maximumFractionDigits: 0 })}`;
    expect(rows.map((r) => r.value)).toEqual(
      [
        a.bets_pass,
        a.deleted_pass,
        a.pass,
        a.cashier_commission,
        a.claims,
        a.subtotal,
        a.previous_balance,
        a.collections,
        a.paid,
        a.bills,
        a.revenue,
        a.total,
      ].map(fmt)
    );
    expect(rows.map((r) => r.value)).toEqual([
      '$100.000',
      '$20.000',
      '$80.000',
      '$12.000',
      '$10.000',
      '$90.000',
      '$30.000',
      '$40.000',
      '$15.000',
      '$5.000',
      '$70.000',
      '$25.000',
    ]);
    expect(rows.filter((r) => r.strong).map((r) => r.label)).toEqual(['Deja', 'Debe']);
  });

  it('cashierLiquidationImageLines: con total negativo dice Cobra y el monto en absoluto', () => {
    const rows = cashierLiquidationImageLines({ account: account(-25000) }).filter(
      (l) => l.kind === 'row'
    );
    expect(rows.at(-1)).toEqual({ kind: 'row', label: 'Cobra', value: '$25.000', strong: true });
  });

  it('cashierLiquidationImageLines: sin headerLabel usa Fecha/Período', () => {
    const period = cashierLiquidationImageLines({ account: account(0) });
    expect(period[1]).toEqual({ kind: 'text', text: 'Período 9/11/2026 al 15/11/2026' });
    const day = cashierLiquidationImageLines({
      account: account(0, { period_from: '2026-11-15' }),
    });
    expect(day[1]).toEqual({ kind: 'text', text: 'Fecha 15/11/2026' });
  });

  it('looseFileNames: deja el nombre y desempata con la carpeta de la edición', () => {
    expect(
      looseFileNames([
        'raiz/2026-11-08 Polla/Grupo 1 - Leo 08-11-2026/1-6 Laura 08-11-2026.png',
        'raiz/2026-11-15 Polla/Grupo 1 - Leo 15-11-2026/1-6 Laura 08-11-2026.png',
        'raiz/Grupo 1 - Leo 15-11-2026/1-7 Juan 15-11-2026.png',
      ])
    ).toEqual([
      '2026-11-08 Polla 1-6 Laura 08-11-2026.png',
      '2026-11-15 Polla 1-6 Laura 08-11-2026.png',
      '1-7 Juan 15-11-2026.png',
    ]);
  });

  it('looseFileNames: si todavía se repite, agrega (2)', () => {
    expect(looseFileNames(['r/a/x.png', 'r/a/x.png'])).toEqual(['a x.png', 'a x (2).png']);
  });
});
