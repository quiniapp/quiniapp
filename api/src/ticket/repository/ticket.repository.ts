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
    const { data, error } = await supabase
      .from('tickets')
      .delete()
      .eq('ticket_number', props.ticket_number);

    if (error) throw new Error(error.message);
    return data;
  }
}
