import { Buffer } from 'node:buffer';
import { supabase } from '@database/db.connection';
import { BadRequestError, NotFoundError } from '@helper/errors';
import { IPaginatedResponse } from '@helper/request/pagination.request';
import {
  IPollaBetDerivedFields,
  IPollaBetEntityBack,
  IPollaBetToRepeat,
  IPollaDailySalesGroup,
  IPollaRepeatResult,
} from '@helper/polla/types/game.type';
import { throwIfPollaError } from '../../helper/polla-errors';
import { PollaPagination, buildPaginated } from '../../helper/pagination';
import { pollaToday } from '../../helper/date';

/** El grupo del pasador viaja embebido: es la columna "Coord" del listado. */
const BET_COLUMNS = '*, polla_groups(name)';

/** Jugada tal como la devuelve el repositorio: la fila más los campos derivados. */
export type PollaBetRow = IPollaBetEntityBack & IPollaBetDerivedFields;

type RawBetRow = IPollaBetEntityBack & { polla_groups: { name: string } | null };

const withDerivedFields = ({ polla_groups: group, ...bet }: RawBetRow): PollaBetRow => ({
  ...bet,
  group_name: group?.name ?? null,
  // Si la jugó el propio pasador no hay cliente.
  client_name: bet.polla_user_id === bet.cashier_polla_user_id ? null : bet.user_name,
});

/** Ranking de aciertos (predeterminado) o carga más reciente primero. */
export type PollaBetSort = 'hits' | 'recent';

export interface PollaBetFilters {
  editionId?: string;
  organizationId?: string | null;
  cashierId?: string | null;
  userId?: string | null;
  groupId?: string | null;
  ticketNumber?: string | null;
  loadDate?: string | null;
  /** Día en que se completó (ganadoras de ese día, para la liquidación). */
  hitDate?: string | null;
  /** Cargadas entre estas fechas (tickets del período que se liquida). */
  loadRange?: { from: string; to: string } | null;
  /** Completadas entre estas fechas (ganadoras del período que se liquida). */
  hitRange?: { from: string; to: string } | null;
  /**
   * Solo las borradas que se descuentan del pase entre estas fechas (las
   * "Borradas" del período que se liquida).
   */
  deductedRange?: { from: string; to: string } | null;
  /**
   * Además de las activas, las borradas que siguen en el pase de jugadas de su
   * día de carga (`deducted_on`): los tickets del período cuadran con el pase.
   */
  withDeducted?: boolean;
  onlyWinners?: boolean;
  /** `true`: solo ganadoras; `false`: solo no ganadoras. */
  winner?: boolean | null;
  /** Aciertos exactos (cualquiera de la lista). */
  hits?: number[] | null;
}

export interface PollaBetQueryOptions {
  sort: PollaBetSort;
  /** Keyset: posición de la última fila de la página previa (ver `encodeCursor`). */
  cursor?: string | null;
}

export interface PollaBetPage<T> extends IPaginatedResponse<T> {
  next_cursor?: string | null;
}

/** Dónde puede buscar un ticket para repetirlo quien lo pide. */
export interface PollaBetTicketScope {
  organizationId: string | null;
  groupId?: string | null;
  cashierId?: string | null;
  userId?: string | null;
}

/** Columnas de un ticket para repetirlo. */
const REPEAT_COLUMNS =
  'polla_bet_id, ticket_number, polla_edition_id, numbers, user_name, polla_user_id, cashier_polla_user_id, load_date';

type RepeatRow = Omit<IPollaBetToRepeat, 'holder_type'> & {
  polla_user_id: string;
  cashier_polla_user_id: string;
};

const toRepeat = ({
  polla_user_id,
  cashier_polla_user_id,
  ...bet
}: RepeatRow): IPollaBetToRepeat => ({
  ...bet,
  holder_type: polla_user_id === cashier_polla_user_id ? 'CASHIER' : 'PLAYER',
});

/**
 * Un ticket sin el sufijo `-<pasador>` (solo los 17 dígitos) se busca por
 * prefijo, como en QuiniApp. Llega validado (dígitos y un guion), así que el
 * LIKE no recibe comodines.
 */
const ticketPattern = (ticketNumber: string) =>
  /^\d{17}$/.test(ticketNumber)
    ? { op: 'like' as const, value: `${ticketNumber}-%` }
    : { op: 'eq' as const, value: ticketNumber };

interface CursorPosition {
  hits: number;
  createdAt: string;
  id: string;
}

const encodeCursor = (row: PollaBetRow, sort: PollaBetSort) => {
  const parts =
    sort === 'hits'
      ? [row.hits, row.created_at, row.polla_bet_id]
      : [row.created_at, row.polla_bet_id];
  return Buffer.from(parts.join('|')).toString('base64url');
};

// El cursor lo manda el cliente y sus partes se interpolan en un filtro `or=`
// de PostgREST, que es un mini-lenguaje con comas y paréntesis: sin validar,
// se pueden inyectar cláusulas extra. Solo se aceptan un entero chico, un
// timestamp ISO y un UUID, así que no queda ningún carácter con significado en
// ese lenguaje.
const CURSOR_HITS = /^\d{1,2}$/;
const CURSOR_TIMESTAMP =
  /^\d{4}-\d{2}-\d{2}[T ]\d{2}:\d{2}:\d{2}(\.\d{1,6})?([+-]\d{2}:?\d{2}|Z)?$/;
const CURSOR_UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const decodeCursor = (cursor: string, sort: PollaBetSort): CursorPosition => {
  let decoded: string;
  try {
    decoded = Buffer.from(cursor, 'base64url').toString('utf8');
  } catch {
    throw new BadRequestError('Cursor inválido');
  }

  const parts = decoded.split('|');
  const [hits, createdAt, id] = sort === 'hits' ? parts : ['0', ...parts];

  if (
    parts.length !== (sort === 'hits' ? 3 : 2) ||
    !CURSOR_HITS.test(hits ?? '') ||
    !CURSOR_TIMESTAMP.test(createdAt ?? '') ||
    !CURSOR_UUID.test(id ?? '')
  ) {
    throw new BadRequestError('Cursor inválido');
  }

  return { hits: Number(hits), createdAt, id };
};

/** Filas que van después del cursor, en el mismo orden que el listado. */
const afterCursor = ({ hits, createdAt, id }: CursorPosition, sort: PollaBetSort) => {
  if (sort === 'recent') {
    return `created_at.lt.${createdAt},and(created_at.eq.${createdAt},polla_bet_id.lt.${id})`;
  }

  return [
    `hits.lt.${hits}`,
    `and(hits.eq.${hits},created_at.lt.${createdAt})`,
    `and(hits.eq.${hits},created_at.eq.${createdAt},polla_bet_id.lt.${id})`,
  ].join(',');
};

export class PollaBetRepository {
  async getAll(
    filters: PollaBetFilters,
    pagination: PollaPagination,
    options: PollaBetQueryOptions
  ): Promise<PollaBetPage<PollaBetRow>> {
    const useKeyset = Boolean(options.cursor);

    let query = supabase.from('polla_bets').select(
      BET_COLUMNS,
      // Con keyset no tiene sentido el COUNT exacto: es lo más caro de la query.
      pagination.withCount && !useKeyset ? { count: 'exact' } : {}
    );

    // Las anuladas sin pasar por la cuenta corriente (`deducted_on` null) no
    // salen nunca.
    if (filters.deductedRange) {
      query = query
        .gte('deducted_on', filters.deductedRange.from)
        .lte('deducted_on', filters.deductedRange.to);
    } else if (filters.withDeducted) {
      query = query.or('deleted_at.is.null,deducted_on.not.is.null');
    } else {
      query = query.is('deleted_at', null);
    }

    if (filters.editionId) query = query.eq('polla_edition_id', filters.editionId);
    if (filters.organizationId) query = query.eq('polla_organization_id', filters.organizationId);
    if (filters.cashierId) query = query.eq('cashier_polla_user_id', filters.cashierId);
    if (filters.userId) query = query.eq('polla_user_id', filters.userId);
    if (filters.groupId) query = query.eq('polla_group_id', filters.groupId);
    if (filters.ticketNumber) query = query.eq('ticket_number', filters.ticketNumber);
    if (filters.loadDate) query = query.eq('load_date', filters.loadDate);
    if (filters.hitDate) query = query.eq('hit_date', filters.hitDate);
    if (filters.loadRange) {
      query = query.gte('load_date', filters.loadRange.from).lte('load_date', filters.loadRange.to);
    }
    if (filters.hitRange) {
      query = query.gte('hit_date', filters.hitRange.from).lte('hit_date', filters.hitRange.to);
    }
    if (filters.onlyWinners) query = query.eq('winner', true);
    if (filters.winner !== undefined && filters.winner !== null) {
      query = query.eq('winner', filters.winner);
    }
    if (filters.hits?.length) query = query.in('hits', filters.hits);

    if (useKeyset) {
      query = query.or(afterCursor(decodeCursor(options.cursor!, options.sort), options.sort));
    }

    if (options.sort === 'hits') query = query.order('hits', { ascending: false });

    query = query
      .order('created_at', { ascending: false })
      .order('polla_bet_id', { ascending: false });

    const { data, error, count } = useKeyset
      ? await query.limit(pagination.limit)
      : await query.range(pagination.from, pagination.to);

    throwIfPollaError(error);

    const rows = ((data ?? []) as unknown as RawBetRow[]).map(withDerivedFields);
    const page = buildPaginated(
      rows,
      pagination,
      pagination.withCount && !useKeyset ? (count ?? 0) : null
    );

    const last = rows[rows.length - 1];

    return {
      ...page,
      next_cursor:
        last && rows.length === pagination.limit ? encodeCursor(last, options.sort) : null,
    };
  }

  async getById(betId: string): Promise<PollaBetRow> {
    const { data, error } = await supabase
      .from('polla_bets')
      .select(BET_COLUMNS)
      .eq('polla_bet_id', betId)
      .is('deleted_at', null)
      .maybeSingle();

    throwIfPollaError(error);
    if (!data) throw new NotFoundError('Jugada de Polla');
    return withDerivedFields(data as unknown as RawBetRow);
  }

  /**
   * Ticket a repetir, completo o por prefijo (ver `ticketPattern`); el alcance
   * evita mezclar pasadores.
   */
  async getByTicketNumber(
    ticketNumber: string,
    scope: PollaBetTicketScope
  ): Promise<IPollaBetToRepeat> {
    const ticket = ticketPattern(ticketNumber);
    let query = supabase
      .from('polla_bets')
      .select(REPEAT_COLUMNS)
      .is('deleted_at', null)
      .filter('ticket_number', ticket.op, ticket.value);

    if (scope.organizationId) query = query.eq('polla_organization_id', scope.organizationId);
    if (scope.groupId) query = query.eq('polla_group_id', scope.groupId);
    if (scope.cashierId) query = query.eq('cashier_polla_user_id', scope.cashierId);
    if (scope.userId) query = query.eq('polla_user_id', scope.userId);

    const { data, error } = await query
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    throwIfPollaError(error);
    if (!data) throw new NotFoundError('Ticket de Polla');
    return toRepeat(data as RepeatRow);
  }

  /** Jugada completa de un ticket de la organización, para "Revisar ticket". */
  async getForCheck(ticketNumber: string, organizationId: string): Promise<PollaBetRow> {
    const ticket = ticketPattern(ticketNumber);
    const { data, error } = await supabase
      .from('polla_bets')
      .select(BET_COLUMNS)
      .is('deleted_at', null)
      .eq('polla_organization_id', organizationId)
      .filter('ticket_number', ticket.op, ticket.value)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    throwIfPollaError(error);
    if (!data) throw new NotFoundError('Ticket de Polla');
    return withDerivedFields(data as unknown as RawBetRow);
  }

  /**
   * Última jugada que cargó el propio usuario a su nombre, para repetirla. Las
   * que le cargó su pasador no cuentan; las anteriores a `created_by` sí.
   * `pollaUserId` sale de la sesión (un UUID), así que el filtro `or` es seguro.
   */
  async getLastByUser(pollaUserId: string): Promise<IPollaBetToRepeat> {
    const { data, error } = await supabase
      .from('polla_bets')
      .select(REPEAT_COLUMNS)
      .eq('polla_user_id', pollaUserId)
      .or(`created_by.eq.${pollaUserId},created_by.is.null`)
      .is('deleted_at', null)
      .order('created_at', { ascending: false })
      // El número de ticket arranca con la hora de carga: desempata en el mismo instante.
      .order('ticket_number', { ascending: false })
      .limit(1)
      .maybeSingle();

    throwIfPollaError(error);
    if (!data) throw new NotFoundError('Jugada anterior');
    return toRepeat(data as RepeatRow);
  }

  /**
   * Tickets del usuario (no borrados) en la última edición en que jugó, para
   * que el jugador elija cuáles repetir. Incluye los que le cargó su pasador.
   */
  async getLastEditionBetsOfUser(pollaUserId: string): Promise<IPollaBetToRepeat[]> {
    const { data: last, error: lastError } = await supabase
      .from('polla_bets')
      .select('polla_edition_id')
      .eq('polla_user_id', pollaUserId)
      .is('deleted_at', null)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    throwIfPollaError(lastError);
    if (!last) return [];

    const { data, error } = await supabase
      .from('polla_bets')
      .select(REPEAT_COLUMNS)
      .eq('polla_user_id', pollaUserId)
      .eq('polla_edition_id', (last as { polla_edition_id: string }).polla_edition_id)
      .is('deleted_at', null)
      .order('created_at', { ascending: true })
      .order('ticket_number', { ascending: true })
      .limit(200);

    throwIfPollaError(error);
    return ((data ?? []) as RepeatRow[]).map(toRepeat);
  }

  /**
   * Boletas vendidas en el día por grupo (sin las repetidas sin cargo); con
   * `cashierId`, solo las de ese pasador; con `groupId`, solo ese grupo.
   */
  async getDailySales(
    organizationId: string,
    date: string,
    cashierId: string | null,
    groupId: string | null = null
  ): Promise<IPollaDailySalesGroup[]> {
    const { data, error } = await supabase.rpc('polla_daily_sales', {
      p_organization_id: organizationId,
      p_date: date,
      p_cashier_id: cashierId,
      p_group_id: groupId,
    });

    throwIfPollaError(error);
    return ((data ?? []) as IPollaDailySalesGroup[]).map((row) => ({
      ...row,
      bets_count: Number(row.bets_count),
      amount: Number(row.amount),
    }));
  }

  /**
   * Alta de una jugada. El corte y a nombre de quién puede cargar salen del
   * rol del actor (la RPC); `date` solo lo respeta para superadmin+.
   */
  async create(params: {
    editionId: string;
    actorId: string;
    targetUserId: string;
    numbers: string[];
    date?: string;
  }) {
    const { data, error } = await supabase.rpc('polla_create_bet', {
      p_edition_id: params.editionId,
      p_actor_user_id: params.actorId,
      p_target_user_id: params.targetUserId,
      p_numbers: params.numbers,
      p_date: params.date ?? pollaToday(),
    });

    throwIfPollaError(error);
    return (data as { bet: IPollaBetEntityBack }).bet;
  }

  async updateNumbers(betId: string, numbers: string[], actorId: string) {
    const { data, error } = await supabase.rpc('polla_update_bet_numbers', {
      p_bet_id: betId,
      p_numbers: numbers,
      p_actor_id: actorId,
    });

    throwIfPollaError(error);
    return (data as { bet: IPollaBetEntityBack }).bet;
  }

  async remove(betId: string, actorId: string) {
    const { data, error } = await supabase.rpc('polla_delete_bet', {
      p_bet_id: betId,
      p_actor_id: actorId,
    });

    throwIfPollaError(error);
    // `deducted_on`: día en que la baja se descuenta del pase del pasador.
    return data as { success: boolean; deducted_on: string };
  }

  /**
   * Repite tickets en una edición, a nombre de su dueño original. Los que no
   * se pueden (fuera de alcance, usuario dado de baja, etc.) vuelven en
   * `skipped` con el código de la base.
   */
  async repeat(params: {
    actorId: string;
    editionId: string;
    betIds: string[];
    free: boolean;
  }): Promise<IPollaRepeatResult> {
    const { data, error } = await supabase.rpc('polla_repeat_bets', {
      p_actor_id: params.actorId,
      p_edition_id: params.editionId,
      p_bet_ids: params.betIds,
      p_free: params.free,
    });

    throwIfPollaError(error);
    return data as IPollaRepeatResult;
  }

  /** Cuántas veces se repitió sin cargo cada ticket (vigentes). */
  async getFreeRepeatCounts(betIds: string[]): Promise<Record<string, number>> {
    if (betIds.length === 0) return {};

    const { data, error } = await supabase
      .from('polla_bets')
      .select('repeated_from_bet_id')
      .in('repeated_from_bet_id', betIds)
      .eq('is_free', true)
      .is('deleted_at', null);

    throwIfPollaError(error);

    const counts: Record<string, number> = {};
    for (const row of (data ?? []) as { repeated_from_bet_id: string }[]) {
      counts[row.repeated_from_bet_id] = (counts[row.repeated_from_bet_id] ?? 0) + 1;
    }
    return counts;
  }

  /** Totales de una edición sin escanear jugadas fila por fila en el cliente. */
  async getEditionSummary(editionId: string) {
    const { data, error } = await supabase
      .from('polla_bets')
      .select('hits, winner, prize')
      .eq('polla_edition_id', editionId)
      .is('deleted_at', null)
      .eq('winner', true);

    throwIfPollaError(error);
    return data ?? [];
  }
}
