import { supabase } from '@database/db.connection';
import { BadRequestError, ForbiddenError, NotFoundError } from '@helper/errors';
import { IPollaOrgExpenseEntityBack } from '@helper/polla/types/game.type';
import { throwIfPollaError } from '../../helper/polla-errors';

export class PollaExpenseRepository {
  /**
   * Gastos de una edición (`polla_edition_id`) o, para el historial, de un
   * día (`date`). Sin grupo, los de la organización; con grupo, los de ese grupo.
   * Por día van solo los gastos por fecha: uno por edición lleva la fecha en
   * que se cargó, pero es de su edición.
   */
  async getAll(
    organizationId: string,
    scope: { editionId: string } | { date: string },
    groupId: string | null
  ): Promise<IPollaOrgExpenseEntityBack[]> {
    let query = supabase
      .from('polla_org_expenses')
      .select('*')
      .eq('polla_organization_id', organizationId);

    query =
      'editionId' in scope
        ? query.eq('polla_edition_id', scope.editionId)
        : query.eq('date', scope.date).is('polla_edition_id', null);

    query = groupId ? query.eq('polla_group_id', groupId) : query.is('polla_group_id', null);

    const { data, error } = await query.order('created_at', { ascending: true });

    throwIfPollaError(error);
    return (data ?? []) as IPollaOrgExpenseEntityBack[];
  }

  async create(payload: {
    polla_organization_id: string;
    polla_group_id: string | null;
    polla_edition_id: string;
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
    const { data: existing, error: existingError } = await supabase
      .from('polla_org_expenses')
      .select('polla_edition_id')
      .eq('polla_org_expense_id', expenseId)
      .eq('polla_organization_id', organizationId)
      .maybeSingle();

    throwIfPollaError(existingError);
    if (!existing) throw new NotFoundError('Gasto');
    if (!existing.polla_edition_id) {
      throw new ForbiddenError('Los gastos por fecha quedaron solo para consultar');
    }

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
