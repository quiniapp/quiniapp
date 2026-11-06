import { supabase } from '@database/db.connection';
import { IPollaPrize } from '@helper/polla/types/game.type';
import { throwIfPollaError } from '../../helper/polla-errors';

/** Tope de ganadores por edición que se listan (una edición tiene pocos). */
const MAX_PRIZES = 1000;

// `paid_by` viene por la FK de `prize_paid_by` (polla_bets tiene varias a polla_users).
const PRIZE_COLUMNS =
  'polla_bet_id, polla_edition_id, ticket_number, polla_user_id, cashier_polla_user_id, user_name, cashier_name, cashier_number, identifier, hits, prize, hit_date, prize_paid_at, polla_groups(name, number), paid_by:polla_users!polla_bets_prize_paid_by_fkey(name)';

type RawPrize = {
  polla_bet_id: string;
  polla_edition_id: string;
  ticket_number: string;
  polla_user_id: string;
  cashier_polla_user_id: string;
  user_name: string;
  cashier_name: string;
  cashier_number: number | null;
  identifier: string | null;
  hits: number;
  prize: number;
  hit_date: string | null;
  prize_paid_at: string | null;
  polla_groups: { name: string; number: number } | null;
  paid_by: { name: string } | null;
};

const toPrize = (row: RawPrize): IPollaPrize => ({
  polla_bet_id: row.polla_bet_id,
  polla_edition_id: row.polla_edition_id,
  ticket_number: row.ticket_number,
  group_name: row.polla_groups?.name ?? null,
  group_number: row.polla_groups?.number ?? null,
  cashier_name: row.cashier_name,
  cashier_number: row.cashier_number,
  // Si lo jugó el propio pasador no hay cliente.
  client_name: row.polla_user_id === row.cashier_polla_user_id ? null : row.user_name,
  identifier: row.identifier,
  hits: row.hits,
  prize: Number(row.prize),
  hit_date: row.hit_date,
  prize_paid_at: row.prize_paid_at,
  prize_paid_by_name: row.paid_by?.name ?? null,
});

export interface PollaPrizeFilters {
  organizationId: string;
  editionId: string;
  /** Alcance del rol (R21): lo imputado a un pasador, un grupo o un jugador. */
  cashierId?: string;
  groupId?: string;
  userId?: string;
}

export class PollaPrizeRepository {
  /**
   * Marca el premio como pagado (R20): solo dueño, capitalista y superadmin,
   * solo ganadoras y sin vuelta atrás. Lo controla la RPC.
   */
  async markPaid(actorId: string, betId: string) {
    const { data, error } = await supabase.rpc('polla_mark_prize_paid', {
      p_actor_id: actorId,
      p_bet_id: betId,
    });

    throwIfPollaError(error);
    return data as { polla_bet_id: string; prize_paid_at: string; prize_paid_by: string };
  }

  /**
   * Los tickets ganadores de una edición (los de la generación de ganadores),
   * vigentes, ordenados por grupo y pasador.
   */
  async getAll(filters: PollaPrizeFilters): Promise<IPollaPrize[]> {
    let query = supabase
      .from('polla_bets')
      .select(PRIZE_COLUMNS)
      .eq('polla_organization_id', filters.organizationId)
      .eq('polla_edition_id', filters.editionId)
      .eq('winner', true)
      .is('deleted_at', null);

    if (filters.cashierId) query = query.eq('cashier_polla_user_id', filters.cashierId);
    if (filters.groupId) query = query.eq('polla_group_id', filters.groupId);
    if (filters.userId) query = query.eq('polla_user_id', filters.userId);

    const { data, error } = await query
      .order('cashier_number', { ascending: true, nullsFirst: false })
      .order('ticket_number', { ascending: true })
      .limit(MAX_PRIZES);

    throwIfPollaError(error);

    return ((data ?? []) as unknown as RawPrize[])
      .map(toPrize)
      .sort(
        (a, b) =>
          (a.group_number ?? Number.MAX_SAFE_INTEGER) - (b.group_number ?? Number.MAX_SAFE_INTEGER)
      );
  }
}
