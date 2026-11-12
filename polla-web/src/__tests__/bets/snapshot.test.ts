import { describe, expect, it } from 'vitest';
import { IPollaBetListItem } from '@helper/polla/types/game.type';
import { filterSnapshot, pastDrawDays, snapshotAtDay } from '@/lib/betsSnapshot';

const NUMBERS = ['01', '02', '03', '04', '05', '06', '07', '08', '09', '10'];

/** Una jugada pública con los días en que acertó cada casillero. */
const bet = (
  ticket: string,
  loadDate: string,
  hitDates: (string | null)[],
  extra: Partial<IPollaBetListItem> = {}
): IPollaBetListItem =>
  ({
    polla_bet_id: ticket,
    ticket_number: ticket,
    polla_edition_id: 'ed',
    cashier_name: 'Pasador',
    cashier_number: 1,
    load_date: loadDate,
    numbers: NUMBERS,
    hit_dates: [...hitDates, ...Array(10 - hitDates.length).fill(null)],
    hit_numbers: NUMBERS.filter((_, i) => hitDates[i]),
    hits: hitDates.filter(Boolean).length,
    winner: false,
    hit_date: null,
    prize: 0,
    amount: null,
    deducted_on: null,
    is_mine: false,
    is_free: false,
    identifier: null,
    payment_status: null,
    created_at: `${loadDate}T10:00:00Z`,
    group_name: null,
    group_number: null,
    client_name: null,
    can_edit: false,
    can_delete: false,
    can_mark_paid: false,
    ...extra,
  }) as IPollaBetListItem;

const D1 = '2026-11-02';
const D2 = '2026-11-03';
const D3 = '2026-11-04';

describe('snapshotAtDay (R24)', () => {
  it('deja afuera los tickets cargados después de ese día', () => {
    const rows = [bet('A', D1, []), bet('B', D3, [])];
    expect(snapshotAtDay(rows, D2).map((r) => r.ticket_number)).toEqual(['A']);
  });

  it('un ticket cargado el mismo día del sorteo entra (polla del sábado)', () => {
    expect(snapshotAtDay([bet('A', D2, [])], D2)).toHaveLength(1);
  });

  it('cuenta solo los aciertos de los sorteos hasta ese día', () => {
    const [row] = snapshotAtDay([bet('A', D1, [D1, D2, D3, null])], D2);
    expect(row.hits).toBe(2);
    expect(row.hit_dates.slice(0, 4)).toEqual([D1, D2, null, null]);
    expect(row.hit_numbers).toEqual(['01', '02']);
  });

  it('es ganadora solo si ganó ese día o antes; si no, sin premio', () => {
    const winner = bet('A', D1, Array(10).fill(D3), {
      winner: true,
      hit_date: D3,
      prize: 5000,
    });
    const before = snapshotAtDay([winner], D2)[0];
    expect(before.winner).toBe(false);
    expect(before.prize).toBe(0);
    expect(before.hit_date).toBeNull();

    const after = snapshotAtDay([winner], D3)[0];
    expect(after.winner).toBe(true);
    expect(after.prize).toBe(5000);
  });

  it('ordena por los aciertos de ese día y, a igual cantidad, lo último cargado primero', () => {
    const rows = [
      // Hoy tiene 3 aciertos, pero al D1 solo 1.
      bet('A', D1, [D1, D3, D3]),
      bet('B', D1, [D1, D1], { created_at: `${D1}T09:00:00Z` }),
      bet('C', D1, [D1, D1], { created_at: `${D1}T11:00:00Z` }),
    ];
    expect(snapshotAtDay(rows, D1).map((r) => r.ticket_number)).toEqual(['C', 'B', 'A']);
  });

  it('con "Más recientes" respeta el orden que mandó la API', () => {
    const rows = [bet('A', D1, []), bet('B', D1, [D1])];
    expect(snapshotAtDay(rows, D1, 'recent').map((r) => r.ticket_number)).toEqual(['A', 'B']);
  });
});

describe('filterSnapshot', () => {
  const rows = [
    bet('A', D1, Array(10).fill(D1), { winner: true, hit_date: D1, prize: 100 }),
    bet('B', D1, [D1, D1]),
    bet('C', D1, [D1]),
  ];

  it('filtra ganadoras y no ganadoras de la foto', () => {
    expect(filterSnapshot(rows, { winner: true }).map((r) => r.ticket_number)).toEqual(['A']);
    expect(filterSnapshot(rows, { winner: false }).map((r) => r.ticket_number)).toEqual(['B', 'C']);
  });

  it('filtra por aciertos exactos', () => {
    expect(filterSnapshot(rows, { hits: '2,1' }).map((r) => r.ticket_number)).toEqual(['B', 'C']);
  });

  it('sin filtros devuelve todo', () => {
    expect(filterSnapshot(rows, {})).toHaveLength(3);
  });
});

describe('pastDrawDays', () => {
  const edition = { start_date: D1, end_date: D3 };

  it('todos los días de sorteo si la edición ya terminó', () => {
    expect(pastDrawDays(edition, '2026-11-10')).toEqual([D1, D2, D3]);
  });

  it('hasta hoy si todavía se está sorteando', () => {
    expect(pastDrawDays(edition, D2)).toEqual([D1, D2]);
  });

  it('ninguno si todavía no empezó', () => {
    expect(pastDrawDays(edition, '2026-11-01')).toEqual([]);
  });

  it('una edición de un solo día (el sábado) tiene ese día', () => {
    expect(pastDrawDays({ start_date: D2, end_date: D2 }, D2)).toEqual([D2]);
  });
});
