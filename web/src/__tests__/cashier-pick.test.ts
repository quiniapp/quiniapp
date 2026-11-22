import { describe, expect, it } from 'vitest';
import { NO_GROUP, filterByGroup, pickedVisible } from '@/lib/cashierPick';

type Row = { id: string; group: string | null };
const rows: Row[] = [
  { id: 'a', group: 'g1' },
  { id: 'b', group: 'g2' },
  { id: 'c', group: null },
];
const idOf = (row: Row) => row.id;
const groupOf = (row: Row) => row.group;
const selected = new Set(['a', 'b', 'c']);

describe('Exportar liquidación (QuiniApp): filtro de grupo y elegidos', () => {
  it('"Todos los grupos" deja todos los tildados', () =>
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
    expect(pickedVisible(filterByGroup(rows, NO_GROUP, groupOf), selected, idOf).map(idOf)).toEqual(
      ['c']
    ));
  it('sin grupos en la organización no filtra nada', () =>
    expect(filterByGroup(rows, 'g1')).toEqual(rows));
  it('los no tildados no entran aunque se vean', () =>
    expect(pickedVisible(rows, new Set(['b']), idOf).map(idOf)).toEqual(['b']));
});
