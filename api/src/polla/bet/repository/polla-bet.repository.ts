import { Buffer } from 'node:buffer';
import { supabase } from '@database/db.connection';
import { NotFoundError } from '@helper/errors';
import { IPaginatedResponse } from '@helper/request/pagination.request';
import { IPollaBetEntityBack } from '@helper/polla/types/game.type';
import { throwIfPollaError } from '../../helper/polla-errors';
import { PollaPagination, buildPaginated } from '../../helper/pagination';

/** Columnas mínimas para la vista de jugador: sin PII. */
const ANONYMOUS_COLUMNS =
  'polla_bet_id, ticket_number, polla_edition_id, numbers, hit_numbers, hits, winner, hit_date, polla_user_id, user_name, created_at';

const FULL_COLUMNS = '*';

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
  anonymous: boolean;
  /** Keyset: `${created_at}|${polla_bet_id}` de la última fila de la página previa. */
  cursor?: string | null;
}

export interface PollaBetPage<T> extends IPaginatedResponse<T> {
  next_cursor?: string | null;
}

const encodeCursor = (row: { created_at: string; polla_bet_id: string }) =>
  Buffer.from(`${row.created_at}|${row.polla_bet_id}`).toString('base64url');

const decodeCursor = (cursor: string): { createdAt: string; id: string } | null => {
  try {
    const [createdAt, id] = Buffer.from(cursor, 'base64url').toString('utf8').split('|');
    if (!createdAt || !id) return null;
    return { createdAt, id };
  } catch {
    return null;
  }
};

export class PollaBetRepository {
  async getAll(
    filters: PollaBetFilters,
    pagination: PollaPagination,
    options: PollaBetQueryOptions
  ): Promise<PollaBetPage<Record<string, unknown>>> {
    const useKeyset = Boolean(options.cursor);

    let query = supabase
      .from('polla_bets')
      .select(
        options.anonymous ? ANONYMOUS_COLUMNS : FULL_COLUMNS,
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
      const decoded = decodeCursor(options.cursor!);
      if (decoded) {
        query = query.or(
          `created_at.lt.${decoded.createdAt},and(created_at.eq.${decoded.createdAt},polla_bet_id.lt.${decoded.id})`
        );
      }
    }

    query = query
      .order('created_at', { ascending: false })
      .order('polla_bet_id', { ascending: false });

    const { data, error, count } = useKeyset
      ? await query.limit(pagination.limit)
      : await query.range(pagination.from, pagination.to);

    throwIfPollaError(error);

    const rows = (data ?? []) as unknown as Array<Record<string, unknown>>;
    const page = buildPaginated(
      rows,
      pagination,
      pagination.withCount && !useKeyset ? (count ?? 0) : null
    );

    const last = rows[rows.length - 1] as { created_at: string; polla_bet_id: string } | undefined;

    return {
      ...page,
      next_cursor:
        last && rows.length === pagination.limit
          ? encodeCursor({ created_at: last.created_at, polla_bet_id: last.polla_bet_id })
          : null,
    };
  }

  async getById(betId: string): Promise<IPollaBetEntityBack> {
    const { data, error } = await supabase
      .from('polla_bets')
      .select('*')
      .eq('polla_bet_id', betId)
      .is('deleted_at', null)
      .maybeSingle();

    throwIfPollaError(error);
    if (!data) throw new NotFoundError('Jugada de Polla');
    return data as IPollaBetEntityBack;
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
