import { IOrganizationEntityBack } from '@helper/types/organization.type';
import { supabase } from '@database/db.connection';
import dayjs from 'dayjs';

export class OrganizationRepository {
  async getById(id: string): Promise<IOrganizationEntityBack> {
    const { data, error } = await supabase
      .from('organizations')
      .select('*')
      .eq('organization_id', id)
      .is('deleted_at', null)
      .single();

    if (error) throw new Error(error.details);
    return data;
  }

  async getAll(): Promise<IOrganizationEntityBack[]> {
    const { data, error } = await supabase
      .from('organizations')
      .select('*')
      .is('deleted_at', null)
      .order('created_at', { ascending: true });

    if (error) throw new Error(error.details);
    return data;
  }

  async create(payload: { name: string }): Promise<IOrganizationEntityBack> {
    const { data, error } = await supabase
      .from('organizations')
      .insert({ name: payload.name })
      .select()
      .single();

    if (error) throw new Error(error.details);
    return data;
  }

  async update(id: string, payload: Partial<{ name: string }>): Promise<IOrganizationEntityBack> {
    const timestamp = dayjs().toISOString();
    const { data, error } = await supabase
      .from('organizations')
      .update({ ...payload, edited_at: timestamp })
      .eq('organization_id', id)
      .select()
      .single();

    if (error) throw new Error(error.details);
    return data;
  }

  async delete(id: string): Promise<void> {
    const timestamp = dayjs().toISOString();

    // Cascade soft delete: marcar como eliminados todos los registros relacionados
    // El orden es importante: primero los registros más dependientes, luego los menos dependientes

    // 1. Eliminar ticket_prizes_by_turn
    const { error: prizesError } = await supabase
      .from('ticket_prizes_by_turn')
      .update({ deleted_at: timestamp })
      .eq('organization_id', id)
      .is('deleted_at', null);

    if (prizesError)
      throw new Error(`Error deleting ticket_prizes_by_turn: ${prizesError.details}`);

    // 2. Eliminar bets
    const { error: betsError } = await supabase
      .from('bets')
      .update({ deleted_at: timestamp })
      .eq('organization_id', id)
      .is('deleted_at', null);

    if (betsError) throw new Error(`Error deleting bets: ${betsError.details}`);

    // 3. Eliminar tickets
    const { error: ticketsError } = await supabase
      .from('tickets')
      .update({ deleted_at: timestamp })
      .eq('organization_id', id)
      .is('deleted_at', null);

    if (ticketsError) throw new Error(`Error deleting tickets: ${ticketsError.details}`);

    // 4. Eliminar current_accounts
    const { error: accountsError } = await supabase
      .from('current_accounts')
      .update({ deleted_at: timestamp })
      .eq('organization_id', id)
      .is('deleted_at', null);

    if (accountsError) throw new Error(`Error deleting current_accounts: ${accountsError.details}`);

    // 5. Eliminar results
    const { error: resultsError } = await supabase
      .from('results')
      .update({ deleted_at: timestamp })
      .eq('organization_id', id)
      .is('deleted_at', null);

    if (resultsError) throw new Error(`Error deleting results: ${resultsError.details}`);

    // 6. Eliminar schedule_lotteries
    const { error: scheduleLotteriesError } = await supabase
      .from('schedule_lotteries')
      .update({ deleted_at: timestamp })
      .eq('organization_id', id)
      .is('deleted_at', null);

    if (scheduleLotteriesError)
      throw new Error(`Error deleting schedule_lotteries: ${scheduleLotteriesError.details}`);

    // 7. Eliminar schedules
    const { error: schedulesError } = await supabase
      .from('schedules')
      .update({ deleted_at: timestamp })
      .eq('organization_id', id)
      .is('deleted_at', null);

    if (schedulesError) throw new Error(`Error deleting schedules: ${schedulesError.details}`);

    // 8. Eliminar lotteries
    const { error: lotteriesError } = await supabase
      .from('lotteries')
      .update({ deleted_at: timestamp })
      .eq('organization_id', id)
      .is('deleted_at', null);

    if (lotteriesError) throw new Error(`Error deleting lotteries: ${lotteriesError.details}`);

    // 9. Eliminar users
    const { error: usersError } = await supabase
      .from('users')
      .update({ deleted_at: timestamp })
      .eq('organization_id', id)
      .is('deleted_at', null);

    if (usersError) throw new Error(`Error deleting users: ${usersError.details}`);

    // 10. Finalmente, eliminar la organización
    const { error: orgError } = await supabase
      .from('organizations')
      .update({ deleted_at: timestamp })
      .eq('organization_id', id);

    if (orgError) throw new Error(`Error deleting organization: ${orgError.details}`);
  }
}
