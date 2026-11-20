/**
 * verify-keyset.ts — Verifica la paginación keyset contra Supabase LOCAL
 * (docs/plan-rendimiento-sql.md, "Verificación end-to-end").
 *
 * Requiere el dataset de `api/supabase/scripts/seed_perf.sql`. Recorre los
 * listados con cursor hasta el final y comprueba:
 *   - orden estricto (sin duplicados, sin saltos) según el ORDER BY del listado;
 *   - cantidad recorrida = COUNT(*) del set filtrado;
 *   - totales de la primera request = suma de lo recorrido;
 *   - `totalCount` de tickets = cantidad recorrida;
 *   - un cursor manipulado responde 400.
 *
 *   cd api && npx tsx scripts/verify-keyset.ts
 *
 * Aborta si SUPABASE_URL no apunta a localhost.
 */
import { randomUUID } from 'node:crypto';
import { URL } from 'node:url';
import { SUPABASE_URL } from '../envs';
import { supabase } from '../database/db.connection';
import { BetRepository } from '../src/bet/repository/bet.repository';
import { BetController } from '../src/bet/controller/bet.controller';
import { TicketRepository } from '../src/ticket/repository/ticket.repository';
import { TicketController } from '../src/ticket/controller/ticket.controller';
import { PollaBetRepository, PollaBetSort } from '../src/polla/bet/repository/polla-bet.repository';
import { encodeCursor } from '../src/utils/keyset';
import { getCacheStatus, initializeActiveDaysCache } from '../src/archive/helper/archive-helper';
import { USER_TYPE } from '@helper/types/user.type';

if (!/^https?:\/\/(127\.0\.0\.1|localhost)(:\d+)?/.test(SUPABASE_URL)) {
  console.error(`ABORTADO: SUPABASE_URL no es local (${new URL(SUPABASE_URL).hostname}).`);
  process.exit(1);
}

let failures = 0;
const check = (ok: boolean, label: string, detail = '') => {
  if (!ok) failures++;
  console.log(`${ok ? 'OK  ' : 'FAIL'} ${label}${detail ? ` — ${detail}` : ''}`);
};

/** Timestamp de PostgREST → microsegundos (Date trunca a milisegundos). */
const micros = (ts: string): bigint => {
  const m = ts.match(/^(.+?:\d{2})(?:\.(\d{1,6}))?([+-]\d{2}:?\d{2}|Z)?$/);
  if (!m) throw new Error(`timestamp inesperado: ${ts}`);
  const base = Date.parse(`${m[1]}${m[3] ?? 'Z'}`);
  return BigInt(base) * 1000n + BigInt((m[2] ?? '').padEnd(6, '0'));
};

type Key = (bigint | number | string)[];
/** -1 si a va antes que b en el orden del listado, según la dirección de cada columna. */
const compare = (a: Key, b: Key, dirs: ('asc' | 'desc')[]) => {
  for (let i = 0; i < a.length; i++) {
    if (a[i] === b[i]) continue;
    const lt = a[i] < b[i];
    return (dirs[i] === 'asc') === lt ? -1 : 1;
  }
  return 0;
};

type Page<T> = { data: T[]; hasMore: boolean; next_cursor: string | null };
// eslint-disable-next-line no-unused-vars
type FetchPage<T> = (cursor: string) => Promise<Page<T>>;

async function traverse<T>(
  label: string,
  fetchPage: FetchPage<T>,
  // eslint-disable-next-line no-unused-vars
  keyOf: (row: T) => Key,
  dirs: ('asc' | 'desc')[],
  expectedCount: number
): Promise<T[]> {
  const rows: T[] = [];
  let cursor = '';
  let pages = 0;
  let badCursors = 0;
  for (;;) {
    const page = await fetchPage(cursor);
    pages++;
    rows.push(...page.data);
    if (!page.hasMore) {
      if (page.next_cursor !== null) badCursors++;
      break;
    }
    if (page.next_cursor === null) badCursors++;
    cursor = page.next_cursor!;
    if (pages > 10_000) throw new Error('demasiadas páginas');
  }
  check(
    badCursors === 0,
    `${label}: next_cursor coherente con hasMore`,
    `${badCursors} páginas mal`
  );

  let outOfOrder = 0;
  for (let i = 1; i < rows.length; i++) {
    if (compare(keyOf(rows[i - 1]), keyOf(rows[i]), dirs) >= 0) outOfOrder++;
  }
  check(outOfOrder === 0, `${label}: orden estricto`, `${outOfOrder} pares fuera de orden`);
  check(
    rows.length === expectedCount,
    `${label}: recorrido = COUNT(*)`,
    `${rows.length} recorridas (${pages} páginas) vs ${expectedCount}`
  );
  return rows;
}

const countOf = async (table: string, filters: Record<string, string | boolean>) => {
  let q = supabase.from(table).select('*', { count: 'exact', head: true }).is('deleted_at', null);
  for (const [k, v] of Object.entries(filters)) q = q.eq(k, v);
  const { count, error } = await q;
  if (error) throw error;
  return count ?? 0;
};

async function main() {
  // Como al levantar el server: sin el cache de días activos todo va a las tablas principales.
  await initializeActiveDaysCache();

  const { data: org } = await supabase
    .from('organizations')
    .select('organization_id')
    .eq('name', 'perf-org-1')
    .single();
  if (!org) throw new Error('Falta el dataset: correr seed_perf.sql');
  const orgId = org.organization_id as string;

  const { data: lastBet } = await supabase
    .from('bets')
    .select('date')
    .eq('organization_id', orgId)
    .order('date', { ascending: false })
    .limit(1)
    .single();
  const day = lastBet!.date as string;
  // Día que la API resuelve contra el archivo: anterior al día activo más viejo
  // del cache (activity_days), de cualquier organización.
  const cutoff = getCacheStatus().cachedDays.at(-1);
  const { data: archived } = cutoff
    ? await supabase
        .from('bets_archive')
        .select('organization_id, date')
        .lt('date', cutoff)
        .is('deleted_at', null)
        .order('date', { ascending: false })
        .limit(1)
        .maybeSingle()
    : { data: null };

  const bets = new BetRepository();
  const betKey = (b: { created_at: string; bet_order: number; bet_id: string }): Key => [
    micros(b.created_at),
    b.bet_order,
    b.bet_id,
  ];
  const BET_DIRS: ('asc' | 'desc')[] = ['desc', 'asc', 'asc'];

  // 1. Jugadas del día completo (organización más grande del dataset).
  const all = await traverse(
    `bets ${day}`,
    (cursor) => bets.getAllBets({ organization_ids: [orgId], date: day, cursor, limit: 900 }),
    betKey,
    BET_DIRS,
    await countOf('bets', { organization_id: orgId, date: day })
  );

  // 2. Totales de la primera request = suma de lo recorrido (filtros base).
  const controller = new BetController();
  const first = await controller.getAllBets({ organization_ids: [orgId], date: day, limit: 50 });
  const sumAmount = all.reduce((acc, b) => acc + Number(b.amount), 0);
  const sumPrize = all.reduce((acc, b) => acc + (b.winner ? Number(b.prize ?? 0) : 0), 0);
  check(
    Math.abs((first.aggregates?.totalAmount ?? NaN) - sumAmount) < 0.01,
    'aggregates.totalAmount = suma recorrida',
    `${first.aggregates?.totalAmount} vs ${sumAmount}`
  );
  check(
    Math.abs((first.aggregates?.totalPrize ?? NaN) - sumPrize) < 0.01,
    'aggregates.totalPrize = suma recorrida (ganadoras)',
    `${first.aggregates?.totalPrize} vs ${sumPrize}`
  );
  check(first.data.length === 50 && first.pagination.hasMore, 'primera página de 50 con hasMore');
  const second = await controller.getAllBets({
    organization_ids: [orgId],
    date: day,
    limit: 50,
    cursor: first.pagination.next_cursor!,
  });
  check(
    second.aggregates !== undefined && Object.keys(second.aggregates).length === 0,
    'páginas siguientes sin aggregates'
  );

  // 3. Con filtro de pasador y página chica (muchas páginas, empates de created_at).
  const { data: cashier } = await supabase
    .from('users')
    .select('user_id')
    .eq('organization_id', orgId)
    .eq('number', 7)
    .single();
  await traverse(
    'bets por pasador (limit 37)',
    (cursor) =>
      bets.getAllBets({
        organization_ids: [orgId],
        date: day,
        cashier_id: cashier!.user_id,
        cursor,
        limit: 37,
      }),
    betKey,
    BET_DIRS,
    await countOf('bets', { organization_id: orgId, date: day, user_id: cashier!.user_id })
  );

  // 4. Por número de ticket (sin la consulta previa a tickets).
  const { data: ticketRow } = await supabase
    .from('tickets')
    .select('ticket_number')
    .eq('organization_id', orgId)
    .eq('date', day)
    .is('deleted_at', null)
    .limit(1)
    .single();
  await traverse(
    'bets por ticket_number (limit 2)',
    (cursor) =>
      bets.getAllBets({
        organization_ids: [orgId],
        date: day,
        ticket_number: ticketRow!.ticket_number,
        cursor,
        limit: 2,
      }),
    betKey,
    BET_DIRS,
    await countOf('bets', {
      organization_id: orgId,
      date: day,
      ticket_number: ticketRow!.ticket_number,
    })
  );

  // 5. Día archivado.
  if (archived) {
    const { organization_id: archOrg, date: archDay } = archived as {
      organization_id: string;
      date: string;
    };
    await traverse(
      `bets_archive ${archDay}`,
      (cursor) =>
        bets.getAllBets({ organization_ids: [archOrg], date: archDay, cursor, limit: 900 }),
      betKey,
      BET_DIRS,
      await countOf('bets_archive', { organization_id: archOrg, date: archDay })
    );
  } else {
    console.log('SKIP bets_archive: no hay días archivados anteriores al cache de activity_days');
  }

  // 6. Tickets: recorrido + totalCount de la primera request.
  const tickets = new TicketRepository();
  const ticketKey = (t: { created_at: string; ticket_id: string }): Key => [
    micros(t.created_at),
    t.ticket_id,
  ];
  const ticketCount = await countOf('tickets', { organization_id: orgId, date: day });
  await traverse(
    `tickets ${day}`,
    (cursor) => tickets.getAll({ organization_id: orgId, date: day, cursor, limit: 900 }),
    ticketKey,
    ['desc', 'desc'],
    ticketCount
  );
  const ticketController = new TicketController();
  const firstTickets = await ticketController.getAll({
    user_type: USER_TYPE.ADMIN,
    user_id: '',
    organization_id: orgId,
    date: day,
    limit: 50,
  });
  check(
    firstTickets.pagination.totalCount === ticketCount,
    'tickets: totalCount de la primera request = COUNT(*)',
    `${firstTickets.pagination.totalCount} vs ${ticketCount}`
  );
  const secondTickets = await ticketController.getAll({
    user_type: USER_TYPE.ADMIN,
    user_id: '',
    organization_id: orgId,
    date: day,
    limit: 50,
    cursor: firstTickets.pagination.next_cursor!,
  });
  check(secondTickets.pagination.totalCount === undefined, 'tickets: páginas siguientes sin count');

  // 7. Cursor manipulado → 400.
  for (const evil of [
    'no-es-un-cursor',
    encodeCursor(['2026-11-16T00:00:00+00:00,deleted_at.not.is.null', 1, randomUUID()]),
  ]) {
    try {
      await bets.getAllBets({ organization_ids: [orgId], date: day, cursor: evil, limit: 5 });
      check(false, 'cursor inválido rechazado');
    } catch (err) {
      check((err as { statusCode?: number }).statusCode === 400, 'cursor inválido → 400');
    }
  }

  // 8. Polla: el feed sigue igual después de mover el cursor a utils/keyset.
  const { data: pollaOrg } = await supabase
    .from('polla_organizations')
    .select('polla_organization_id')
    .eq('name', 'perf-polla-1')
    .single();
  const { data: edition } = await supabase
    .from('polla_editions')
    .select('polla_edition_id')
    .eq('polla_organization_id', pollaOrg!.polla_organization_id)
    .eq('status', 'ACTIVE')
    .single();
  const editionCount = await countOf('polla_bets', { polla_edition_id: edition!.polla_edition_id });
  const polla = new PollaBetRepository();
  for (const sort of ['hits', 'recent'] as PollaBetSort[]) {
    await traverse(
      `polla_bets sort=${sort}`,
      async (cursor) => {
        const limit = 900;
        const page = await polla.getAll(
          { editionId: edition!.polla_edition_id },
          { page: 1, limit, from: 0, to: limit - 1, withCount: false },
          { sort, cursor: cursor || null }
        );
        return {
          data: page.data,
          hasMore: page.next_cursor != null,
          next_cursor: page.next_cursor ?? null,
        };
      },
      (b) =>
        sort === 'hits'
          ? [b.hits, micros(b.created_at), b.polla_bet_id]
          : [micros(b.created_at), b.polla_bet_id],
      sort === 'hits' ? ['desc', 'desc', 'desc'] : ['desc', 'desc'],
      editionCount
    );
  }

  console.log(failures === 0 ? '\nTodo OK' : `\n${failures} chequeo(s) fallaron`);
  process.exit(failures === 0 ? 0 : 1);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
