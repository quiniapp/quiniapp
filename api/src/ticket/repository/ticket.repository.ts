import dayjs from 'dayjs';
import { supabase } from '@database/db.connection';
import { IDeleteTicketEntity } from '@helper/request/ticket.response';
import { ITicketEntityBack } from '@helper/types/ticket.type';

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

  async getByNumber(ticket_number: number) {
    const { data, error } = await supabase
      .from('tickets')

      .select('*, bets(*, lotteries(*), schedules(*))')
      .eq('ticket_number', ticket_number)
      .single();

    if (error) throw error;
    return data;
  }
  async getAll({ user_id, date }: { user_id?: string; date: string }) {
    let query = supabase
      .from('tickets')
      .select('*, bets(*, lotteries(*), schedules(*))')
      .eq('date', date)
      .is('deleted_at', null)
      .order('created_at', { ascending: false });

    if (user_id !== undefined) {
      query = query.eq('user_id', user_id);
    }

    const { data, error } = await query;
    if (error) throw error;
    return data;
  }

  async delete(props: IDeleteTicketEntity) {
    const timestamp = dayjs().toISOString();
    const { data, error } = await supabase
      .from('tickets')
      .update({ deleted_at: timestamp, deleted_by: props.user_id })
      .eq('ticket_id', props.ticket_id)
      .select()
      .single();

    if (error) throw new Error(error.message);
    return data;
  }
}
