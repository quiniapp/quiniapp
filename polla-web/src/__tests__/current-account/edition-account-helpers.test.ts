import { describe, expect, it } from 'vitest';
import {
  IPollaCurrentAccountDailyTotals,
  IPollaGroupEditionAccountEntity,
  POLLA_LIQUIDATION_NO_GROUP,
} from '@helper/polla/types/game.type';
import { summaryRowLabel } from '@/functions/current-account/accountTablePDF';
import { rangeRowLines, ticketTitleLine } from '@/functions/current-account/totalsTicket';
import { filterByGroup, pickedVisible } from '@/lib/cashierPick';
import { groupEditionTicketLines } from '@/functions/current-account/groupLiquidationTicket';
import { groupAccountOutdated, groupSplit, owedWord } from '@/lib/editionAccount';

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

describe('Liquidación del grupo: total para el admin y para el capitalista', () => {
  it('al admin, el 100% de la comisión; al capitalista, el resto', () =>
    expect(groupSplit(9000, 1800)).toEqual({ admin: 1800, capitalist: 7200 }));
  it('sin errores de coma flotante y con montos como texto', () =>
    expect(groupSplit('100.10', '33.37')).toEqual({ admin: 33.37, capitalist: 66.73 }));
  it('total negativo: el admin no cobra y el capitalista pone la diferencia', () =>
    expect(groupSplit(-500, 0)).toEqual({ admin: 0, capitalist: -500 }));

  const ticket = (expenses: number) =>
    groupEditionTicketLines({
      account: {
        group_name: 'Grupo 1',
        cashiers_subtotal: 10000,
        expenses,
        base: 10000 - expenses,
        admin_percentage: 20,
        admin_commission: (10000 - expenses) * 0.2,
      },
      orgName: 'Sistema',
      periodText: 'Semana 46',
      time: '21:30',
    });
  const line = (lines: string[], label: string) => lines.find((l) => l.startsWith(label));

  it('el ticket dice TOTAL, % ADMIN, TOTAL ADMIN y TOTAL CAPITALISTA', () => {
    const lines = ticket(1000);
    expect(line(lines, 'TOTAL:')).toMatch(/\$9\.000$/);
    expect(line(lines, '% ADMIN:')).toMatch(/20%$/);
    expect(line(lines, 'TOTAL ADMIN:')).toMatch(/\$1\.800$/);
    expect(line(lines, 'TOTAL CAPITALISTA:')).toMatch(/\$7\.200$/);
    expect(lines.every((l) => l.length <= 32)).toBe(true);
  });
  it('sin base, ajustes ni pagado al admin', () => {
    const text = ticket(1000).join('\n');
    expect(text).not.toMatch(/BASE|Ajustes|Pagado/);
  });
  it('sin gastos no imprime "$-0"', () =>
    expect(line(ticket(0), 'Gastos del grupo:')).toMatch(/ \$0$/));
});
