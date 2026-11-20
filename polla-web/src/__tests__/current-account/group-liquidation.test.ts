import { describe, expect, it } from 'vitest';
import { IPollaGroupEditionAccountPreview } from '@helper/polla/types/game.type';
import {
  type GroupLiquidationSheet,
  groupLiquidationLabel,
  groupLiquidationRows,
  groupLiquidationSheets,
  groupLiquidationTotals,
} from '@/lib/groupLiquidation';
import { groupLiquidationFileName, groupLiquidationZipName } from '@/lib/liquidationZip';
import { groupLiquidationZipEntries } from '@/functions/current-account/groupLiquidationPDF';

const D = '2026-11-15';
const account = {
  polla_group_id: 'g1',
  group_name: 'Leo',
  cashiers_subtotal: 120000,
  expenses: 5000,
  base: 115000,
  admin_percentage: 20,
  admin_commission: 23000,
  edited_at: '2026-11-15T21:30:00.000000+00:00',
};

const sheet = (group: { number?: number; name: string }): GroupLiquidationSheet => ({
  account: { ...account, group_name: group.name },
  group,
  orgName: 'Sistema',
  editionTitle: 'Semana 46',
  date: D,
});

describe('liquidaciones de grupo', () => {
  it('groupLiquidationZipName: fecha y prefijo plus', () => {
    expect(groupLiquidationZipName({ date: D })).toBe('polla_liquidaciones_grupos_15-11-2026.zip');
    expect(groupLiquidationZipName({ date: D, special: true })).toBe(
      'polla_plus_liquidaciones_grupos_15-11-2026.zip'
    );
  });

  it('groupLiquidationFileName: con número, sin número y caracteres prohibidos', () => {
    expect(groupLiquidationFileName({ number: 1, name: 'Leo' }, D, 'pdf')).toBe(
      'Grupo 1 - Leo 15-11-2026.pdf'
    );
    expect(groupLiquidationFileName({ name: 'Leo' }, D, 'png')).toBe('Leo 15-11-2026.png');
    expect(groupLiquidationFileName({ number: 4, name: 'Norte/Sur' }, D, 'pdf')).toBe(
      'Grupo 4 - Norte_Sur 15-11-2026.pdf'
    );
  });

  it('groupLiquidationLabel: Grupo N - Nombre, o el nombre solo', () => {
    expect(groupLiquidationLabel({ number: 2, name: 'Ana' })).toBe('Grupo 2 - Ana');
    expect(groupLiquidationLabel({ name: 'Ana' })).toBe('Ana');
  });

  it('groupLiquidationZipEntries: raíz con fecha y un archivo por grupo, ordenados por número', () => {
    const zipName = groupLiquidationZipName({ date: D });
    const paths = groupLiquidationZipEntries(
      [
        sheet({ name: 'Sin' }),
        sheet({ number: 2, name: 'Ana' }),
        sheet({ number: 1, name: 'Leo' }),
      ],
      zipName,
      'pdf'
    ).map((entry) => entry.path);
    expect(paths).toEqual([
      'polla_liquidaciones_grupos_15-11-2026/Grupo 1 - Leo 15-11-2026.pdf',
      'polla_liquidaciones_grupos_15-11-2026/Grupo 2 - Ana 15-11-2026.pdf',
      'polla_liquidaciones_grupos_15-11-2026/Sin 15-11-2026.pdf',
    ]);
  });

  it('groupLiquidationRows: los seis renglones, capitalista incluido', () => {
    expect(groupLiquidationRows(account)).toEqual([
      { label: 'Deja pasadores', value: '$120.000' },
      { label: 'Gastos del grupo', value: '-$5.000' },
      { label: 'Total', value: '$115.000' },
      { label: '% admin', value: '20%' },
      { label: 'Total admin', value: '$23.000' },
      { label: 'Total capitalista', value: '$92.000' },
    ]);
  });

  it('groupLiquidationRows: sin gastos dice $0', () => {
    expect(groupLiquidationRows({ ...account, expenses: 0 })[1].value).toBe('$0');
  });

  it('desactualizada: los renglones salen de la fila guardada', () => {
    const preview: IPollaGroupEditionAccountPreview = {
      polla_group_id: 'g1',
      group_name: 'Leo',
      polla_edition_id: 'e1',
      cashiers_subtotal: 150000,
      expenses: 20000,
      base: 130000,
      pending_cashiers: [],
      account: {
        ...account,
        polla_edition_id: 'e1',
      } as unknown as IPollaGroupEditionAccountPreview['account'],
    };
    const rows = groupLiquidationRows(preview.account!);
    expect(rows.find((row) => row.label === 'Total')?.value).toBe('$115.000');
  });
});

describe('groupLiquidationSheets', () => {
  const acc = (id: string, edited_at: string) => ({ ...account, polla_group_id: id, edited_at });
  const ctx = {
    groupNumberOf: (id: string) => (id === 'g1' ? 1 : undefined),
    orgName: 'Sistema',
    editionTitle: 'Semana 46',
    today: '2026-12-01',
  };

  it('todas las hojas llevan la fecha de la liquidación más nueva', () => {
    const sheets = groupLiquidationSheets(
      [
        acc('g1', '2026-11-14T10:00:00.000000+00:00'),
        acc('g2', '2026-11-16T12:00:00.000000+00:00'),
      ],
      ctx
    );
    expect(sheets.map((s) => s.date)).toEqual(['2026-11-16', '2026-11-16']);
    expect(sheets[0].orgName).toBe('Sistema');
    expect(sheets[0].editionTitle).toBe('Semana 46');
  });

  it('un grupo que ya no está en el catálogo queda sin número', () => {
    const [a, b] = groupLiquidationSheets(
      [
        acc('g1', '2026-11-15T10:00:00.000000+00:00'),
        acc('g9', '2026-11-15T10:00:00.000000+00:00'),
      ],
      ctx
    );
    expect(a.group.number).toBe(1);
    expect(b.group).toEqual({ number: undefined, name: 'Leo' });
  });

  it('sin liquidaciones no hay hojas', () => {
    expect(groupLiquidationSheets([], ctx)).toEqual([]);
  });
});

describe('groupLiquidationTotals', () => {
  it('suma los grupos de la edición', () => {
    expect(
      groupLiquidationTotals([
        { cashiers_subtotal: 120000, expenses: 5000, base: 115000, admin_commission: 23000 },
        { cashiers_subtotal: 30000, expenses: 0, base: 30000, admin_commission: 4500 },
      ])
    ).toEqual({
      cashiersSubtotal: 150000,
      expenses: 5000,
      total: 145000,
      admin: 27500,
      capitalist: 117500,
    });
  });

  it('suma en centavos y acepta montos en texto (numeric de la API)', () => {
    const rows = [
      { cashiers_subtotal: '0.1', expenses: '0', base: '0.1', admin_commission: '0.05' },
      { cashiers_subtotal: '0.2', expenses: '0', base: '0.2', admin_commission: '0.05' },
    ] as unknown as Parameters<typeof groupLiquidationTotals>[0];
    const totals = groupLiquidationTotals(rows);
    expect(totals).toEqual({
      cashiersSubtotal: 0.3,
      expenses: 0,
      total: 0.3,
      admin: 0.1,
      capitalist: 0.2,
    });
    // Admin + capitalista cierra con el total (en centavos: en JS 0.1 + 0.2 ≠ 0.3).
    expect(Math.round(totals.admin * 100) + Math.round(totals.capitalist * 100)).toBe(
      Math.round(totals.total * 100)
    );
  });

  it('sin liquidaciones da todo en cero', () => {
    expect(groupLiquidationTotals([])).toEqual({
      cashiersSubtotal: 0,
      expenses: 0,
      total: 0,
      admin: 0,
      capitalist: 0,
    });
  });
});
