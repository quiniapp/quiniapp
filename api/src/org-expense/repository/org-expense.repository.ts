import { supabase } from '@database/db.connection';
import dayjs from 'dayjs';

export interface IOrgExpense {
  expense_id: string;
  organization_id: string;
  group_id: string | null;
  date: string;
  name: string;
  amount: number;
  created_at: string;
  edited_at: string;
}

export class OrgExpenseRepository {
  async getByOrgAndDate(
    organization_id: string,
    date: string,
    group_id?: string | null
  ): Promise<IOrgExpense[]> {
    let query = supabase
      .from('org_expenses')
      .select('*')
      .eq('organization_id', organization_id)
      .eq('date', dayjs(date).format('YYYY-MM-DD'));

    if (group_id) {
      query = query.eq('group_id', group_id);
    } else {
      query = query.is('group_id', null);
    }

    const { data, error } = await query.order('created_at', { ascending: true });
    if (error) throw new Error(error.message);
    return data ?? [];
  }

  async getSumsByDateRange(
    organization_id: string,
    date_from: string,
    date_to: string
  ): Promise<{ date: string; total_expenses: number }[]> {
    const { data, error } = await supabase
      .from('org_expenses')
      .select('date, amount')
      .eq('organization_id', organization_id)
      .gte('date', dayjs(date_from).format('YYYY-MM-DD'))
      .lte('date', dayjs(date_to).format('YYYY-MM-DD'));

    if (error) throw new Error(error.message);

    const byDate: Record<string, number> = {};
    for (const row of data ?? []) {
      byDate[row.date] = (byDate[row.date] ?? 0) + Number(row.amount);
    }

    return Object.entries(byDate).map(([date, total_expenses]) => ({ date, total_expenses }));
  }

  async create(
    organization_id: string,
    date: string,
    name: string,
    amount: number,
    group_id?: string | null
  ): Promise<IOrgExpense> {
    const { data, error } = await supabase
      .from('org_expenses')
      .insert({
        organization_id,
        date: dayjs(date).format('YYYY-MM-DD'),
        name,
        amount,
        group_id: group_id ?? null,
      })
      .select()
      .single();

    if (error) throw new Error(error.message);
    return data;
  }

  async delete(expense_id: string, organization_id: string): Promise<void> {
    const { error } = await supabase
      .from('org_expenses')
      .delete()
      .eq('expense_id', expense_id)
      .eq('organization_id', organization_id);

    if (error) throw new Error(error.message);
  }
}
