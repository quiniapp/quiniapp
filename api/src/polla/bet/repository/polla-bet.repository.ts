import { Buffer } from 'node:buffer';
import { supabase } from '@database/db.connection';
import { BadRequestError, NotFoundError } from '@helper/errors';
import { IPaginatedResponse } from '@helper/request/pagination.request';
import {
  IPollaBetDerivedFields,
  IPollaBetEntityBack,
  IPollaBetToRepeat,
} from '@helper/polla/types/game.type';
import { throwIfPollaError } from '../../helper/polla-errors';
import { PollaPagination, buildPaginated } from '../../helper/pagination';

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
  onlyWinners?: boolean;
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
  cashierId?: string | null;
  userId?: string | null;
}

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

    let query = supabase
      .from('polla_bets')
      .select(
        BET_COLUMNS,
        // Con keyset no tiene sentido el COUNT exacto: es lo más caro de la query.
        pagination.withCount && !useKeyset ? { count: 'exact' } : {}
      )
      .is('deleted_at', null);

    if (filters.editionId) query = query.eq('polla_edition_id', filters.editionId);
    if (filters.organizationId) query = query.eq('polla_organization_id', filters.organizationId);
    if (filters.cashierId) query = query.eq('cashier_polla_user_id', filters.cashierId);
    if (filters.userId) query = query.eq('polla_user_id', filters.userId);
    if (filters.groupId) query = query.eq('polla_group_id', filters.groupId);
    if (filters.ticketNumber) query = query.eq('ticket_number', filters.ticketNumber);
    if (filters.loadDate) query = query.eq('load_date', filters.loadDate);
    if (filters.onlyWinners) query = query.eq('winner', true);

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
   * Ticket a repetir. Sin el sufijo `-<pasador>` y con los 17 dígitos completos
   * se busca por prefijo, como en QuiniApp; el alcance evita mezclar pasadores.
   * `ticketNumber` llega validado (solo dígitos y un guion), así que el LIKE no
   * recibe comodines.
   */
  async getByTicketNumber(
    ticketNumber: string,
    scope: PollaBetTicketScope
  ): Promise<IPollaBetToRepeat> {
    let query = supabase
      .from('polla_bets')
      .select('ticket_number, polla_edition_id, numbers')
      .is('deleted_at', null);

    query = /^\d{17}$/.test(ticketNumber)
      ? query.like('ticket_number', `${ticketNumber}-%`)
      : query.eq('ticket_number', ticketNumber);

    if (scope.organizationId) query = query.eq('polla_organization_id', scope.organizationId);
    if (scope.cashierId) query = query.eq('cashier_polla_user_id', scope.cashierId);
    if (scope.userId) query = query.eq('polla_user_id', scope.userId);

    const { data, error } = await query
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    throwIfPollaError(error);
    if (!data) throw new NotFoundError('Ticket de Polla');
    return data as IPollaBetToRepeat;
  }

  async create(params: {
    editionId: string;
    actorId: string;
    targetUserId: string;
    numbers: string[];
    date?: string;
    force: boolean;
  }) {
    const { data, error } = await supabase.rpc('polla_create_bet', {
      p_edition_id: params.editionId,
      p_actor_user_id: params.actorId,
      p_target_user_id: params.targetUserId,
      p_numbers: params.numbers,
      p_date: params.date ?? new Date().toISOString().slice(0, 10),
      p_force: params.force,
    });

    throwIfPollaError(error);
    return (data as { bet: IPollaBetEntityBack }).bet;
  }

  async updateNumbers(betId: string, numbers: string[], actorId: string, force: boolean) {
    const { data, error } = await supabase.rpc('polla_update_bet_numbers', {
      p_bet_id: betId,
      p_numbers: numbers,
      p_actor_id: actorId,
      p_force: force,
    });

    throwIfPollaError(error);
    return (data as { bet: IPollaBetEntityBack }).bet;
  }

  async remove(betId: string, actorId: string, force: boolean) {
    const { data, error } = await supabase.rpc('polla_delete_bet', {
      p_bet_id: betId,
      p_actor_id: actorId,
      p_force: force,
    });

    throwIfPollaError(error);
    return data as { success: boolean };
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
