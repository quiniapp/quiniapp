import { describe, expect, it } from 'vitest';
import { POLLA_EDITION_STATUS } from '@helper/polla/types/game.type';
import { missingIds, preferredEdition, shouldLoadMore, uniqueById } from '@/lib/editionSelect';

describe('shouldLoadMore', () => {
  it('pide más cuando el scroll llega al final', () => {
    expect(shouldLoadMore({ scrollTop: 476, clientHeight: 300, scrollHeight: 800 })).toBe(true);
  });

  it('no pide más al principio de la lista', () => {
    expect(shouldLoadMore({ scrollTop: 0, clientHeight: 300, scrollHeight: 800 })).toBe(false);
  });
});

describe('uniqueById', () => {
  it('descarta los repetidos y deja el primero', () => {
    const r = uniqueById(
      [
        { id: 'a', n: 1 },
        { id: 'b', n: 2 },
        { id: 'a', n: 3 },
      ],
      (t) => t.id
    );
    expect(r).toEqual([
      { id: 'a', n: 1 },
      { id: 'b', n: 2 },
    ]);
  });
});

describe('preferredEdition', () => {
  const { ACTIVE, FINISHED } = POLLA_EDITION_STATUS;

  it('abre en la primera activa de lo cargado (la más nueva)', () => {
    const list = [
      { id: 'a', status: FINISHED },
      { id: 'b', status: ACTIVE },
      { id: 'c', status: ACTIVE },
    ];
    expect(preferredEdition(list)?.id).toBe('b');
  });

  it('sin activas, la primera', () => {
    expect(
      preferredEdition([
        { id: 'a', status: FINISHED },
        { id: 'b', status: FINISHED },
      ])?.id
    ).toBe('a');
  });

  it('sin ediciones, ninguna', () => {
    expect(preferredEdition([])).toBeUndefined();
  });
});

describe('missingIds', () => {
  it('deja las que no se conocen, sin repetir y ordenadas', () => {
    const known = new Set(['b']);
    expect(missingIds(['c', 'b', 'a', 'c'], (id) => known.has(id))).toEqual(['a', 'c']);
  });

  it('si se conocen todas, no pide nada', () => {
    expect(missingIds(['a'], () => true)).toEqual([]);
  });
});
