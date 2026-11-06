import { supabase } from '@database/db.connection';
import { IPollaPrize } from '@helper/polla/types/game.type';
import { throwIfPollaError } from '../../helper/polla-errors';

/** Tope de ganadores por edición que se listan (una edición tiene pocos). */
const MAX_PRIZES = 1000;

const PRIZE_COLUMNS =
  'polla_bet_id, polla_edition_id, ticket_number, polla_user_id, cashier_polla_user_id, user_name, cashier_name, cashier_number, identifier, hits, prize, hit_date, polla_groups(name, number)';

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
  polla_groups: { name: string; number: number } | null;
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
});

export interface PollaPrizeFilters {
  organizationId: string;
  editionId: string;
}

export class PollaPrizeRepository {
  /**
   * Los tickets ganadores de una edición (los de la generación de ganadores),
   * vigentes, ordenados por grupo y pasador.
   */
  async getAll(filters: PollaPrizeFilters): Promise<IPollaPrize[]> {
    const { data, error } = await supabase
      .from('polla_bets')
      .select(PRIZE_COLUMNS)
      .eq('polla_organization_id', filters.organizationId)
      .eq('polla_edition_id', filters.editionId)
      .eq('winner', true)
      .is('deleted_at', null)
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
