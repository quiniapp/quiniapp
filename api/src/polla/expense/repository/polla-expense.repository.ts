import { supabase } from '@database/db.connection';
import { BadRequestError, NotFoundError } from '@helper/errors';
import { IPollaOrgExpenseEntityBack } from '@helper/polla/types/game.type';
import { throwIfPollaError } from '../../helper/polla-errors';

export class PollaExpenseRepository {
  /** Gastos de un día: sin grupo, los de la organización; con grupo, los de ese grupo. */
  async getByDate(
    organizationId: string,
    date: string,
    groupId: string | null
  ): Promise<IPollaOrgExpenseEntityBack[]> {
    let query = supabase
      .from('polla_org_expenses')
      .select('*')
      .eq('polla_organization_id', organizationId)
      .eq('date', date);

    query = groupId ? query.eq('polla_group_id', groupId) : query.is('polla_group_id', null);

    const { data, error } = await query.order('created_at', { ascending: true });

    throwIfPollaError(error);
    return (data ?? []) as IPollaOrgExpenseEntityBack[];
  }

  async create(payload: {
    polla_organization_id: string;
    polla_group_id: string | null;
    date: string;
    name: string;
    amount: number;
    created_by: string;
  }): Promise<IPollaOrgExpenseEntityBack> {
    if (payload.polla_group_id) {
      const { data: group, error: groupError } = await supabase
        .from('polla_groups')
        .select('polla_organization_id')
        .eq('polla_group_id', payload.polla_group_id)
        .is('deleted_at', null)
        .maybeSingle();

      throwIfPollaError(groupError);
      if (group?.polla_organization_id !== payload.polla_organization_id) {
        throw new BadRequestError('El grupo pertenece a otra organización');
      }
    }

    const { data, error } = await supabase
      .from('polla_org_expenses')
      .insert(payload)
      .select('*')
      .single();

    throwIfPollaError(error);
    return data as IPollaOrgExpenseEntityBack;
  }

  async remove(expenseId: string, organizationId: string): Promise<void> {
    const { data, error } = await supabase
      .from('polla_org_expenses')
      .delete()
      .eq('polla_org_expense_id', expenseId)
      .eq('polla_organization_id', organizationId)
      .select('polla_org_expense_id')
      .maybeSingle();

    throwIfPollaError(error);
    if (!data) throw new NotFoundError('Gasto');
  }
}
