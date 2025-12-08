import { supabase } from '@database/db.connection';
import {
  IDeleteTicketEntity,
  IEditTicketBaseEntity,
  INewTicketBaseEntity,
  IPayTicketEntity,
} from '@helper/request/ticket.response';
import { ITicketEntityBack /* ITicketEntityBase */ } from '@helper/types/ticket.type';
import dayjs from 'dayjs';

export class TicketRepository {
  async create(ticket: INewTicketBaseEntity) {
    const { data, error } = await supabase.rpc('create_ticket_with_bets', {
      ticket: ticket,
      bets: ticket.bets,
    });
    if (error) throw error;
    return data;
  }

  async getById(id: string) {
    const { data, error } = await supabase.rpc('ticket_full_json_plpgsql', {
      p_ticket_id: id,
    });

    if (error) throw error;
    // data es jsonb -> castealo a tu tipo si querés
    return data;
  }

  async getByNumber(ticket_number: string) {
    const { data: ticket, error: error_ticket_number } = await supabase
      .from('tickets')
      .select('ticket_id')
      .eq('ticket_number', ticket_number)
      .maybeSingle();
    if (!ticket || error_ticket_number) {
      console.error({ ticket, error_ticket_number });
    }
    const { data, error } = await supabase.rpc('ticket_full_json_plpgsql', {
      p_ticket_id: ticket?.ticket_id,
    });
    if (error) throw error;
    return data;
  }

  async getAll({
    user_id,
    date,
    winner,
    paid,
    page = 1,
    limit = 100,
  }: {
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
      console.log(paid);
      query = query.is('paid', paid);
    }

    const { data, error, count } = await query;
    if (error) throw error;
    return { data, count: count ?? 0 };
  }

  async delete(props: IDeleteTicketEntity) {
    const today = dayjs().toISOString();
    // 1) Actualizo el ticket y me traigo sus IDs para actualizar las bets
    const { data: ticket, error: ticketErr } = await supabase
      .from('tickets')
      .update({ deleted_at: today })
      .eq('ticket_number', props.ticket_number)
      .select('ticket_id'); // importante para actualizar bets

    if (ticketErr) {
      await supabase
        .from('tickets')
        .update({ deleted_at: null })
        .eq('ticket_number', props.ticket_number);

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
        .eq('ticket_number', props.ticket_number);
      await supabase
        .from('bets')
        .update({ deleted_at: null, edited_at: today })
        .eq('ticket_id', ticket[0].ticket_id);

      throw new Error(betsErr.message);
    }

    return { ticket, bets };
  }

  async getAllDeletedTickets({
    user_id,
    date,
  }: {
    user_id?: string;
    date: string;
  }): Promise<number> {
    let query = supabase
      .from('tickets')
      .select('ticket_id', { count: 'exact', head: true })
      .eq('date', date)
      .not('deleted_at', 'is', null); // deleted_at IS NOT NULLF

    if (user_id) query.eq('user_id', user_id);

    const { count, error } = await query;

    if (error && error.message) throw error;
    return count ?? 0;
  }

  async update(props: IEditTicketBaseEntity): Promise<ITicketEntityBack> {
    const { data, error } = await supabase.rpc('edit_ticket_replace_bets', {
      p_ticket_id: props.ticket_id,
      p_bets: props.bets,
    });

    if (error) throw error;
    return data;
  }

  async getAllTicketNumber({
    user_id,
    date,
    winner,
  }: {
    user_id?: string;
    date: string;
    winner: boolean;
  }) {
    let query = supabase
      .from('tickets')
      .select('ticket_id,ticket_number')
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

  async payTicket({ ticket_number, user_id }: IPayTicketEntity): Promise<{
    success: boolean;
    ticket_id: string;
    bets_updated: number;
  }> {
    const { data, error } = await supabase.rpc('pay_ticket', {
      p_ticket_number: ticket_number,
      p_user_id: user_id,
    });

    if (error) {
      // El RPC lanza excepciones específicas que debemos propagar
      throw error;
    }

    return data;
  }
}
