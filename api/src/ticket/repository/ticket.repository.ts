import { supabase } from '@database/db.connection';
import { IDeleteTicketEntity, IEditTicketEntity } from '@helper/request/ticket.response';
import { ITicketEntityBack } from '@helper/types/ticket.type';
import dayjs from 'dayjs';

export class TicketRepository {
  async create(ticket: ITicketEntityBack) {
    const { data, error } = await supabase.rpc('create_ticket_with_bets', {
      ticket: ticket,
      bets: ticket.bets,
    });
    if (error) throw error;
    return data;
  }

  async getById(id: string) {
    const { data, error } = await supabase
      .from('tickets')

      .select('*, bets(*, lotteries(*), schedules(*))')
      .eq('ticket_id', id)
      .single();

    if (error) throw error;
    return data;
  }

  async getByNumber(ticket_number: string) {
    const { data, error } = await supabase
      .from('tickets')

      .select('*, bets(*, lotteries(*), schedules(*))')
      .eq('ticket_number', ticket_number)
      .maybeSingle();

    if (error) throw error;
    return data;
  }
  async getAll({ user_id, date, winner }: { user_id?: string; date: string; winner: boolean }) {
    let query = supabase
      .from('tickets')
      .select('*, bets(*, lotteries(*), schedules(*))')
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
    user_id: string;
    date: string;
  }): Promise<number> {
    let query = supabase
      .from('tickets')
      // no traemos filas; solo count exacto
      .select('ticket_id', { count: 'exact', head: true })
      .eq('user_id', user_id)
      .eq('date', date)
      .not('deleted_at', 'is', null); // deleted_at IS NOT NULL

    const { count, error } = await query;
    if (error) throw error;
    return count ?? 0;
  }

  async update(props: IEditTicketEntity): Promise<ITicketEntityBack> {
    const { data, error } = await supabase.rpc('edit_ticket_replace_bets', {
      p_ticket_id: props.ticket_id,
      p_bets: props.bets,
    });
    if (error) throw error;
    return data;
  }
}
