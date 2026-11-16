import { describe, expect, it } from 'vitest';
import {
  IPollaEditionAccountAmounts,
  IPollaEditionAccountListItem,
  IPollaEditionAccountRow,
} from '@helper/polla/types/game.type';
import { AccountPeriodView } from '@/lib/accountPeriod';
import {
  editionAccountView,
  editionFileTag,
  editionsInRange,
  groupCommission,
  hasEditionMovement,
  reportEditionsInRange,
} from '@/lib/editionAccount';
import { liquidationFileName } from '@/functions/current-account/liquidationSlipPDF';

const zeroRow: IPollaEditionAccountAmounts = {
  bets_pass: 0,
  deleted_pass: 0,
  claims: 0,
  pass: 0,
  cashier_commission: 0,
  subtotal: 0,
  revenue: 0,
  collections: 0,
  paid: 0,
  total: 0,
};

const row = {
  ...zeroRow,
  bets_pass: 1000,
  pass: 1000,
  total: 900,
  polla_user_id: 'u1',
  user_name: 'Pedro',
  user_number: 5,
  polla_group_id: 'g1',
  fee: 10,
  live_bets_pass: 1000,
  live_deleted_pass: 0,
  live_fee: 10,
  differs: false,
  liquidation: null,
} as IPollaEditionAccountRow;

const ed = { polla_edition_id: 'e1', start_date: '2026-11-02', end_date: '2026-11-08' };

describe('cuenta por edición', () => {
  it('sin movimiento con todo en 0', () => expect(hasEditionMovement(zeroRow)).toBe(false));
  it.each(['bets_pass', 'deleted_pass', 'claims', 'collections', 'paid'])(
    'con movimiento si %s ≠ 0',
    (k) => expect(hasEditionMovement({ ...zeroRow, [k]: 10 })).toBe(true)
  );
  it('un ticket de cortesía (0) no es movimiento', () =>
    expect(hasEditionMovement({ ...zeroRow, total: 0 })).toBe(false));

  it('la vista no tiene saldo anterior ni gastos', () => {
    const v = editionAccountView(row, ed);
    expect([v.previous_balance, v.bills, v.successes]).toEqual([0, 0, 0]);
    expect([v.previous_drag, v.drag, v.leave]).toEqual([0, 0, 0]);
    expect(v.period_from).toBe(ed.start_date);
    expect(v.date).toBe(ed.end_date);
    expect(v.polla_current_account_id).toBe('e1:u1');
    expect(v.is_liquidated).toBe(false);
    expect(v.total).toBe(900);
  });
  it('is_liquidated sigue a la liquidación', () => {
    const liquidation = {
      polla_edition_liquidation_id: 'l1',
      created_at: '',
      created_by_name: null,
      total: 900,
      kept_previous_tickets: false,
    };
    expect(editionAccountView({ ...row, liquidation }, ed).is_liquidated).toBe(true);
  });

  const view = editionAccountView(row, ed) as AccountPeriodView;
  it('el archivo lleva la edición', () =>
    expect(liquidationFileName(view, '2-5', editionFileTag('Semana 9/11'))).toBe(
      'polla_Exportar_Liquidacion_Edicion_Semana_9_11_Pedro-2-5.pdf'
    ));
  it('sin tag, el archivo sigue con la fecha', () =>
    expect(liquidationFileName(view, '2-5')).toMatch(/_\d{2}-\d{2}-\d{4}_/));
});

describe('ediciones de un rango', () => {
  const item = (id: string, start: string) =>
    ({ edition: { polla_edition_id: id, start_date: start } }) as IPollaEditionAccountListItem;
  const list = [
    item('oct', '2026-10-31'),
    item('nov-1', '2026-11-01'),
    item('nov-2', '2026-11-30'),
    item('dic', '2026-12-01'),
  ];
  it('las ediciones del rango son las que empiezan en él (inclusivo)', () =>
    expect(
      editionsInRange(list, '2026-11-01', '2026-11-30').map((e) => e.edition.polla_edition_id)
    ).toEqual(['nov-1', 'nov-2']));
  it('los reportes de varias ediciones dejan afuera las de carga abierta', () => {
    const withOpen = [
      ...list,
      { ...item('nov-abierta', '2026-11-15'), load_open: true },
      { ...item('nov-cerrada', '2026-11-16'), load_open: false },
    ];
    expect(
      reportEditionsInRange(withOpen, '2026-11-01', '2026-11-30').map(
        (e) => e.edition.polla_edition_id
      )
    ).toEqual(['nov-1', 'nov-2', 'nov-cerrada']);
  });
});

describe('groupCommission', () => {
  it('sin base positiva no hay comisión', () => expect(groupCommission(-50, 10)).toBe(0));
  it('comisión redondeada a 2', () => expect(groupCommission(1234.567, 10)).toBe(123.46));
  it('el % se redondea a 2 decimales antes de calcular', () =>
    expect(groupCommission(220, 12.345)).toBe(27.17));
});
