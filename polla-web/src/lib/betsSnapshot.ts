import dayjs from 'dayjs';
import { IPollaBetListItem } from '@helper/polla/types/game.type';

/**
 * R24: "foto" de la edición al cierre de un día de sorteo. Los tickets que se
 * habían cargado hasta ese día, con los aciertos de los sorteos hasta ese día;
 * ganador solo si ganó ese día o antes (si no, sin premio). Las jugadas que se
 * borraron después no vuelven: la API lista solo las vigentes.
 */
export const snapshotAtDay = (
  rows: IPollaBetListItem[],
  day: string,
  sort: 'hits' | 'recent' = 'hits'
): IPollaBetListItem[] => {
  const snapshot = rows
    .filter((row) => row.load_date <= day)
    .map((row) => {
      const hitDates = row.hit_dates.map((date) => (date && date <= day ? date : null));
      const winner = row.winner && Boolean(row.hit_date) && (row.hit_date as string) <= day;
      return {
        ...row,
        hit_dates: hitDates,
        hit_numbers: row.numbers.filter((_, slot) => hitDates[slot]),
        hits: hitDates.filter(Boolean).length,
        winner,
        hit_date: winner ? row.hit_date : null,
        prize: winner ? row.prize : 0,
      };
    });

  // "Más recientes" conserva el orden de la API; por aciertos se reordena con
  // los de ese día y, a igual cantidad, lo último cargado primero.
  if (sort === 'recent') return snapshot;
  return snapshot.sort(
    (a, b) => b.hits - a.hits || (b.created_at ?? '').localeCompare(a.created_at ?? '')
  );
};

/** Filtros de resultado ("Ganadoras", "Aciertos") aplicados sobre la foto del día. */
export const filterSnapshot = (
  rows: IPollaBetListItem[],
  { winner, hits }: { winner?: boolean; hits?: string }
) => {
  const wanted = hits
    ? new Set(
        hits
          .split(',')
          .map(Number)
          .filter((n) => Number.isInteger(n))
      )
    : null;
  return rows.filter(
    (row) => (winner === undefined || row.winner === winner) && (!wanted || wanted.has(row.hits))
  );
};

/**
 * Días de sorteo de la edición que ya pasaron (hasta hoy): los que se pueden
 * elegir para la foto. Vacío si todavía no empezó a sortearse.
 */
export const pastDrawDays = (
  edition: { start_date: string; end_date: string },
  today: string
): string[] => {
  const days: string[] = [];
  const last = edition.end_date < today ? edition.end_date : today;
  for (let d = dayjs(edition.start_date); !d.isAfter(dayjs(last), 'day'); d = d.add(1, 'day')) {
    days.push(d.format('YYYY-MM-DD'));
  }
  return days;
};
