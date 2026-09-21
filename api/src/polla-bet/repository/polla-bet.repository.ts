import { supabase } from '@database/db.connection';

export class PollaBetRepository {
  async create({
    polla_edition_id,
    user_id,
    user_name,
    numbers,
    organization_id,
  }: {
    polla_edition_id: string;
    user_id: string | null;
    user_name: string;
    numbers: string[];
    organization_id: string;
  }) {
    const { data, error } = await supabase.rpc('create_polla_bet', {
      p_polla_edition_id: polla_edition_id,
      p_user_id: user_id,
      p_user_name: user_name,
      p_numbers: numbers,
      p_organization_id: organization_id,
    });

    if (error) throw error;
    return data;
  }

  async getAll({
    organization_id,
    user_id,
    polla_edition_id,
    lottery_id,
    schedule_id,
    date,
    ticket_number,
  }: {
    organization_id: string;
    user_id?: string;
    polla_edition_id?: string;
    lottery_id?: string;
    schedule_id?: string;
    date?: string;
    ticket_number?: string;
  }) {
    // Filtro por lottery_id/schedule_id/date (usado por "Jugadas y Aciertos"): resolvemos
    // primero qué ediciones de Polla están vigentes ese día para esa quiniela+turno.
    let editionIds: string[] | undefined;
    if (lottery_id || schedule_id || date) {
      let editionsQuery = supabase
        .from('polla_editions')
        .select('polla_edition_id')
        .eq('organization_id', organization_id)
        .is('deleted_at', null);

      if (lottery_id) editionsQuery = editionsQuery.eq('lottery_id', lottery_id);
      if (schedule_id) editionsQuery = editionsQuery.eq('schedule_id', schedule_id);
      if (date) editionsQuery = editionsQuery.lte('start_date', date).gte('end_date', date);

      const { data: editions, error: editionsError } = await editionsQuery;
      if (editionsError) throw new Error(editionsError.details ?? editionsError.message);

      editionIds = (editions ?? []).map((e) => e.polla_edition_id);
      if (editionIds.length === 0) return [];
    }

    let query = supabase
      .from('polla_bets')
      .select('*')
      .eq('organization_id', organization_id)
      .is('deleted_at', null)
      .order('created_at', { ascending: false });

    if (user_id) query = query.eq('user_id', user_id);
    if (polla_edition_id) query = query.eq('polla_edition_id', polla_edition_id);
    if (editionIds) query = query.in('polla_edition_id', editionIds);
    if (ticket_number) query = query.eq('ticket_number', ticket_number);

    const { data, error } = await query;
    if (error) throw new Error(error.details ?? error.message);
    return data;
  }

  async update({
    polla_bet_id,
    numbers,
    organization_id,
  }: {
    polla_bet_id: string;
    numbers: string[];
    organization_id: string;
  }) {
    const { data, error } = await supabase.rpc('update_polla_bet_numbers', {
      p_polla_bet_id: polla_bet_id,
      p_numbers: numbers,
      p_organization_id: organization_id,
    });

    if (error) throw error;
    return data;
  }

  async delete({
    polla_bet_id,
    organization_id,
    deleted_by,
  }: {
    polla_bet_id: string;
    organization_id: string;
    deleted_by: string;
  }) {
    const { data, error } = await supabase.rpc('delete_polla_bet', {
      p_polla_bet_id: polla_bet_id,
      p_organization_id: organization_id,
      p_deleted_by: deleted_by,
    });

    if (error) throw error;
    return data;
  }
}
