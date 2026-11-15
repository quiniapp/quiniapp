import { describe, expect, it } from 'vitest';
import {
  IPollaCurrentAccountDailyTotals,
  IPollaGroupEditionAccountEntity,
  POLLA_LIQUIDATION_NO_GROUP,
} from '@helper/polla/types/game.type';
import { summaryRowLabel } from '@/functions/current-account/accountTablePDF';
import { rangeRowLines, ticketTitleLine } from '@/functions/current-account/totalsTicket';
import { filterByGroup, pickedVisible } from '@/lib/cashierPick';
import { groupAccountOutdated, owedWord } from '@/lib/editionAccount';

const totals = (date: string): IPollaCurrentAccountDailyTotals => ({
  date,
  accounts_count: 1,
  total_bets_pass: 0,
  total_deleted_pass: 0,
  total_pass: 0,
  total_successes: 0,
  total_commission: 0,
  total_claims: 0,
  total_bills: 0,
  total_revenue: 0,
  total_subtotal: 0,
  total_previous_balance: 0,
  total_collections: 0,
  total_paid: 0,
  total_total: 0,
  total_expenses: 0,
  net_balance: 0,
});

describe('reportes de varias ediciones: un renglón por edición', () => {
  it('sin título, el PDF sigue mostrando la fecha', () =>
    expect(summaryRowLabel({ date: '2026-11-14' })).toBe('14/11/2026'));
  it('con título, la fecha corta y el título (dos que empiezan el mismo día se distinguen)', () => {
    const regular = summaryRowLabel({ date: '2026-11-14', label: 'Semana Nacional' });
    const special = summaryRowLabel({ date: '2026-11-14', label: 'Especial sábado' });
    expect(regular).toBe('14/11 · Semana Nacional');
    expect(special).toBe('14/11 · Especial sábado');
    expect(regular).not.toBe(special);
  });

  it('en el ticket, sin título queda una sola línea (el historial no cambia)', () =>
    expect(rangeRowLines(totals('2026-11-14'), '14/11/26 Deja:   $100')).toEqual([
      '14/11/26 Deja:   $100',
    ]));
  it('con título, el título va en su propia línea arriba de los números', () =>
    expect(
      rangeRowLines({ ...totals('2026-11-14'), label: 'Especial sábado' }, '14/11/26 Deja: $1')
    ).toEqual(['Especial sábado', '14/11/26 Deja: $1']));
  it('el título se corta a 32 caracteres y sin saltos de línea', () => {
    const line = ticketTitleLine('  Una edición con un nombre\nmuy pero muy largo  ');
    expect(line).toBe('Una edición con un nombre muy pe');
    expect(line).toHaveLength(32);
  });
});

describe('cuenta del grupo vieja', () => {
  const account = {
    cashiers_subtotal: 270,
    expenses: 50,
  } as IPollaGroupEditionAccountEntity;

  it('sin liquidación no hay nada viejo', () =>
    expect(groupAccountOutdated({ cashiers_subtotal: 270, expenses: 50, account: null })).toBe(
      false
    ));
  it('igual a la liquidación (aunque venga como texto) no está vieja', () =>
    expect(
      groupAccountOutdated({
        cashiers_subtotal: '270.00' as unknown as number,
        expenses: 50,
        account,
      })
    ).toBe(false));
  it('si cambió lo que dejaron los pasadores, está vieja', () =>
    expect(groupAccountOutdated({ cashiers_subtotal: 360, expenses: 50, account })).toBe(true));
  it('si cambiaron los gastos, está vieja', () =>
    expect(groupAccountOutdated({ cashiers_subtotal: 270, expenses: 80, account })).toBe(true));
});

describe('Liquidar: solo los tildados que se ven', () => {
  type Row = { id: string; group: string | null };
  const rows: Row[] = [
    { id: 'a', group: 'g1' },
    { id: 'b', group: 'g2' },
    { id: 'c', group: null },
  ];
  const idOf = (row: Row) => row.id;
  const groupOf = (row: Row) => row.group;
  const selected = new Set(['a', 'b', 'c']);

  it('sin filtro, todos los tildados', () =>
    expect(pickedVisible(filterByGroup(rows, '', groupOf), selected, idOf).map(idOf)).toEqual([
      'a',
      'b',
      'c',
    ]));
  it('con un grupo, los tildados de otros grupos no entran', () =>
    expect(pickedVisible(filterByGroup(rows, 'g1', groupOf), selected, idOf).map(idOf)).toEqual([
      'a',
    ]));
  it('"Sin grupo" deja solo los que no tienen grupo', () =>
    expect(
      pickedVisible(filterByGroup(rows, POLLA_LIQUIDATION_NO_GROUP, groupOf), selected, idOf).map(
        idOf
      )
    ).toEqual(['c']));
  it('sin filtro de grupo (Exportar liquidación por días) no filtra nada', () =>
    expect(filterByGroup(rows, 'g1')).toEqual(rows));
});

describe('Debe o Cobra', () => {
  it('en cero dice Debe (nunca "Cobra $0,00")', () => expect(owedWord(0)).toBe('Debe'));
  it('positivo: Debe', () => expect(owedWord(150)).toBe('Debe'));
  it('negativo: Cobra', () => expect(owedWord(-20)).toBe('Cobra'));
  it('acepta el monto como texto', () => expect(owedWord('-0.01')).toBe('Cobra'));
});
