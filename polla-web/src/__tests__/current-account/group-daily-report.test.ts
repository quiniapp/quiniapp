import { describe, expect, it } from 'vitest';
import {
  GroupReportAccount,
  groupRangeByEdition,
  groupReportDate,
  groupReportRows,
  groupReportTotals,
  outdatedGroupNames,
  unliquidatedGroupNames,
} from '@/lib/groupDailyReport';

const acc = (
  group: string,
  edition: string,
  base: number,
  admin: number,
  editedAt: string,
  name = group
): GroupReportAccount => ({
  polla_group_id: group,
  polla_edition_id: edition,
  group_name: name,
  base,
  admin_commission: admin,
  edited_at: editedAt,
});

const groups = new Map([
  ['g1', { number: 1, name: 'Leo' }],
  ['g2', { number: 2, name: 'Centro' }],
]);

describe('groupReportRows y totales', () => {
  it('una fila por grupo (por número), capitalista = total − admin y totales en centavos', () => {
    const rows = groupReportRows(
      [
        acc('g2', 'e1', 50.1, 5.01, '2026-11-15T15:00:00Z'),
        acc('g1', 'e1', 100.2, 10.02, '2026-11-15T14:00:00Z'),
      ],
      groups
    );
    expect(rows.map((r) => r.label)).toEqual(['Grupo 1 - Leo', 'Grupo 2 - Centro']);
    expect(rows[0]).toMatchObject({ total: 100.2, admin: 10.02, capitalist: 90.18 });
    expect(groupReportTotals(rows)).toEqual({ total: 150.3, admin: 15.03, capitalist: 135.27 });
  });

  it('base negativa: el admin no cobra y el capitalista queda en negativo', () => {
    const [row] = groupReportRows([acc('g1', 'e1', -30, 0, '2026-11-15T14:00:00Z')], groups);
    expect(row).toMatchObject({ total: -30, admin: 0, capitalist: -30 });
  });

  it('un grupo que ya no está queda al final con el nombre guardado', () => {
    const rows = groupReportRows(
      [
        acc('gx', 'e1', 10, 1, '2026-11-15T14:00:00Z', 'Viejo'),
        acc('g2', 'e1', 10, 1, '2026-11-15T14:00:00Z'),
      ],
      groups
    );
    expect(rows.map((r) => r.label)).toEqual(['Grupo 2 - Centro', 'Viejo']);
  });

  it('en el rango suma las ediciones de cada grupo', () => {
    const rows = groupReportRows(
      [
        acc('g1', 'e1', 100, 10, '2026-11-08T14:00:00Z'),
        acc('g1', 'e2', 80, 8, '2026-11-15T14:00:00Z'),
      ],
      groups
    );
    expect(rows).toEqual([
      { groupId: 'g1', label: 'Grupo 1 - Leo', total: 180, admin: 18, capitalist: 162 },
    ]);
  });
});

describe('groupReportDate', () => {
  it('la última liquidación de los grupos, o null', () => {
    expect(
      groupReportDate([
        { edited_at: '2026-11-14T15:00:00Z' },
        { edited_at: '2026-11-16T15:00:00Z' },
      ])
    ).toBe('2026-11-16');
    expect(groupReportDate([])).toBeNull();
  });
});

describe('groupRangeByEdition', () => {
  it('una fila por edición con la suma de sus grupos, por fecha de liquidación', () => {
    const rows = groupRangeByEdition([
      acc('g1', 'e2', 80, 8, '2026-11-15T14:00:00Z'),
      acc('g1', 'e1', 100, 10, '2026-11-08T14:00:00Z'),
      acc('g2', 'e1', 50, 5, '2026-11-09T14:00:00Z'),
    ]);
    expect(rows).toEqual([
      { editionId: 'e1', liquidatedAt: '2026-11-09', total: 150, admin: 15, capitalist: 135 },
      { editionId: 'e2', liquidatedAt: '2026-11-15', total: 80, admin: 8, capitalist: 72 },
    ]);
  });
});

describe('avisos del parte', () => {
  const preview = (over: Partial<Parameters<typeof unliquidatedGroupNames>[0][number]>) => ({
    group_name: 'G',
    cashiers_subtotal: 0,
    expenses: 0,
    base: 0,
    pending_cashiers: [],
    account: null,
    ...over,
  });
  const stored = {
    polla_group_edition_account_id: 'a',
    polla_organization_id: 'o',
    polla_group_id: 'g',
    polla_edition_id: 'e',
    group_name: 'G',
    cashiers_subtotal: 100,
    expenses: 0,
    base: 100,
    admin_percentage: 10,
    admin_commission: 10,
    adjustments: 0,
    paid: 0,
    total: 10,
    created_by: null,
    created_at: '',
    edited_at: '',
  };

  it('sin liquidar: solo los que tienen algo; los vacíos no se avisan', () => {
    expect(
      unliquidatedGroupNames([
        preview({ group_name: 'Vacío' }),
        preview({ group_name: 'Con pase', cashiers_subtotal: 90, base: 90 }),
        preview({
          group_name: 'Pendiente',
          pending_cashiers: [{ polla_user_id: 'p', name: 'P', number: 1 }],
        }),
        preview({ group_name: 'Liquidado', cashiers_subtotal: 100, base: 100, account: stored }),
      ])
    ).toEqual(['Con pase', 'Pendiente']);
  });

  it('desactualizados: cambió lo que dejaron o los gastos', () => {
    expect(
      outdatedGroupNames([
        preview({ group_name: 'Al día', cashiers_subtotal: 100, base: 100, account: stored }),
        preview({ group_name: 'Viejo', cashiers_subtotal: 120, base: 120, account: stored }),
      ])
    ).toEqual(['Viejo']);
  });
});
