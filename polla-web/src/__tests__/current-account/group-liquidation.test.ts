import { describe, expect, it } from 'vitest';
import { IPollaGroupEditionAccountPreview } from '@helper/polla/types/game.type';
import { groupLiquidationLabel, groupLiquidationRows } from '@/lib/groupLiquidation';
import { groupLiquidationFileName, groupLiquidationZipName } from '@/lib/liquidationZip';
import {
  GroupLiquidationSheet,
  groupLiquidationZipEntries,
} from '@/functions/current-account/groupLiquidationPDF';

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
