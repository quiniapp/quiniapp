import { supabase } from '@database/db.connection';
import {
  IDeleteTicketEntity,
  IEditTicketBaseEntity,
  INewTicketBaseEntity,
  IPayTicketEntity,
} from '@helper/request/ticket.request';
import { ITicketEntityBack /* ITicketEntityBase */ } from '@helper/types/ticket.type';
import dayjs from 'dayjs';

export class TicketRepository {
  async create(ticket: INewTicketBaseEntity & { organization_id: string }) {
    const { data, error } = await supabase.rpc('create_ticket_with_bets', {
      ticket: ticket,
      p_organization_id: ticket.organization_id,
    });
    if (error) throw error;
    return data;
  }

  async getById(id: string, organization_id: string) {
    const { data, error } = await supabase.rpc('ticket_full_json_plpgsql', {
      p_ticket_id: id,
      p_organization_id: organization_id,
    });

    if (error) throw error;
    return data;
  }

  async getByNumber(ticket_number: string, organization_id: string) {
    const { data: ticket, error: error_ticket_number } = await supabase
      .from('tickets')
      .select('ticket_id')
      .eq('ticket_number', ticket_number)
      .eq('organization_id', organization_id)
      .maybeSingle();
    if (!ticket || error_ticket_number) {
      console.error({ ticket, error_ticket_number });
    }
    const { data, error } = await supabase.rpc('ticket_full_json_plpgsql', {
      p_ticket_id: ticket?.ticket_id,
      p_organization_id: organization_id,
    });
    if (error) throw error;
    return data;
  }

  async getAll({
    organization_id,
    user_id,
    date,
    winner,
    paid,
    page = 1,
    limit = 100,
  }: {
    organization_id: string;
    user_id?: string;
    date: string;
    winner?: boolean;
    paid?: boolean;
    page?: number;
    limit?: number;
  }) {
    const from = (page - 1) * limit;
    const to = from + limit - 1;

    let query = supabase
      .from('tickets')
      .select('*', { count: 'exact' })
      .eq('organization_id', organization_id)
      .eq('date', date)
      .is('deleted_at', null)
      .order('created_at', { ascending: false })
      .range(from, to);

    if (user_id !== undefined) {
      query = query.eq('user_id', user_id);
    }
    if (winner) {
      query = query.is('winner', true);
    }

    if (typeof paid === 'boolean') {
      query = query.is('paid', paid);
      if (!paid) {
        query = query.is('winner', true);
      }
    }

    const { data, error, count } = await query;
    if (error) throw error;
    return { data, count: count ?? 0 };
  }

  async delete(props: IDeleteTicketEntity & { organization_id: string }) {
    const today = dayjs().toISOString();
    const { data: ticket, error: ticketErr } = await supabase
      .from('tickets')
      .update({ deleted_at: today })
      .eq('ticket_number', props.ticket_number)
      .eq('organization_id', props.organization_id)
      .select('ticket_id');

    if (ticketErr) {
      await supabase
        .from('tickets')
        .update({ deleted_at: null })
        .eq('ticket_number', props.ticket_number)
        .eq('organization_id', props.organization_id);

      throw new Error(ticketErr.message);
    }
    if (!ticket || ticket.length === 0) return { tickets: [], bets: [] };

    const { data: bets, error: betsErr } = await supabase
      .from('bets')
      .update({ deleted_at: today, edited_at: today })
      .eq('ticket_id', ticket[0].ticket_id);

    if (betsErr) {
      await supabase
        .from('tickets')
        .update({ deleted_at: null })
        .eq('ticket_number', props.ticket_number)
        .eq('organization_id', props.organization_id);
      await supabase
        .from('bets')
        .update({ deleted_at: null, edited_at: today })
        .eq('ticket_id', ticket[0].ticket_id);

      throw new Error(betsErr.message);
    }

    return { ticket, bets };
  }

  async getAllDeletedTickets({
    organization_id,
    user_id,
    date,
  }: {
    organization_id: string;
    user_id?: string;
    date: string;
  }): Promise<number> {
    let query = supabase
      .from('tickets')
      .select('ticket_id', { count: 'exact', head: true })
      .eq('organization_id', organization_id)
      .eq('date', date)
      .not('deleted_at', 'is', null);

    if (user_id) query.eq('user_id', user_id);

    const { count, error } = await query;

    if (error && error.message) throw error;
    return count ?? 0;
  }

  async update(
    props: IEditTicketBaseEntity & { organization_id: string }
  ): Promise<ITicketEntityBack> {
    const { data, error } = await supabase.rpc('edit_ticket_replace_bets', {
      p_ticket_id: props.ticket_id,
      p_bets: props.bets,
      p_organization_id: props.organization_id,
    });

    if (error) throw error;
    return data;
  }

  async getAllTicketNumber({
    organization_id,
    user_id,
    date,
    winner,
  }: {
    organization_id: string;
    user_id?: string;
    date: string;
    winner: boolean;
  }) {
    let query = supabase
      .from('tickets')
      .select('ticket_id,ticket_number')
      .eq('organization_id', organization_id)
      .eq('date', date)
      .is('deleted_at', null)
      .order('created_at', { ascending: false });

    if (user_id !== undefined) {
      query = query.eq('user_id', user_id);
    }
    if (winner) {
      query = query.is('winner', true);
    }
    const { data, error } = await query;
    if (error) throw error;
    return data;
  }

  async payTicket({
    ticket_number,
    user_id,
    organization_id,
  }: IPayTicketEntity & { organization_id: string }): Promise<{
    success: boolean;
    ticket_id: string;
    bets_updated: number;
  }> {
    const { data, error } = await supabase.rpc('pay_ticket', {
      p_ticket_number: ticket_number,
      p_user_id: user_id,
      p_organization_id: organization_id,
    });

    if (error) {
      throw error;
    }

    return data;
  }
}
