import { supabase } from '@database/db.connection';
import { NotFoundError } from '@helper/errors';
import {
  IPollaEditionAccountListItem,
  IPollaEditionAccountMovement,
  IPollaEditionAccountRow,
  IPollaEditionAccountTotals,
  IPollaEditionEntityBack,
  IPollaEditionLiquidationResult,
  IPollaGroupEditionAccountEntity,
  IPollaGroupEditionAccountPreview,
} from '@helper/polla/types/game.type';
import {
  IGenerateEditionLiquidationPayload,
  IPollaAccountMovementPayload,
  IPollaAccountMovementUpdatePayload,
} from '@helper/polla/schemas/game.schema';
import { throwIfPollaError } from '../../helper/polla-errors';

const MOVEMENT_COLUMNS =
  '*, creator:polla_users!polla_edition_account_movements_created_by_fkey(name)';

type MovementRow = IPollaEditionAccountMovement & { creator?: { name: string } | null };

/** Quita el embed del creador y lo deja como `created_by_name`. */
const toMovement = ({ creator, ...movement }: MovementRow): IPollaEditionAccountMovement => ({
  ...movement,
  created_by_name: creator?.name ?? null,
});

/**
 * Cuenta por edición: el cálculo y las liquidaciones viven en la base
 * (`polla_edition_account_*`); acá solo se llaman y se mapean.
 */
export class PollaEditionAccountRepository {
  /**
   * Ediciones con la carga cerrada o que ya empezaron (con `load_open`), de la
   * más nueva a la más vieja. Cada fila trae `total_count` (cuántas hay con esos
   * filtros, sin la página).
   */
  async list(p: {
    organizationId: string;
    /** `null`: todas; `false`: a liquidar; `true`: liquidaciones realizadas. */
    liquidated: boolean | null;
    from: string | null;
    to: string | null;
    withCounts: boolean;
    limit: number;
    offset: number;
  }): Promise<
    (Omit<IPollaEditionAccountListItem, 'edition'> & {
      polla_edition_id: string;
      total_count: number;
    })[]
  > {
    const { data, error } = await supabase.rpc('polla_edition_account_list', {
      p_organization_id: p.organizationId,
      p_liquidated: p.liquidated,
      p_from: p.from,
      p_to: p.to,
      p_with_counts: p.withCounts,
      p_limit: p.limit,
      p_offset: p.offset,
    });

    throwIfPollaError(error);
    return data ?? [];
  }

  /** La cuenta de todos los grupos de la organización en la edición, en una consulta. */
  async groupPreviews(
    organizationId: string,
    editionId: string
  ): Promise<IPollaGroupEditionAccountPreview[]> {
    const { data, error } = await supabase.rpc('polla_group_edition_account_previews', {
      p_organization_id: organizationId,
      p_edition_id: editionId,
    });

    throwIfPollaError(error);
    return data ?? [];
  }

  async accounts(p: {
    organizationId: string;
    editionId: string;
    groupId?: string | null;
    userId?: string | null;
  }): Promise<IPollaEditionAccountRow[]> {
    const { data, error } = await supabase.rpc('polla_edition_account_rows', {
      p_organization_id: p.organizationId,
      p_edition_id: p.editionId,
      p_group_id: p.groupId ?? null,
      p_user_id: p.userId ?? null,
    });

    throwIfPollaError(error);
    return data ?? [];
  }

  async liquidate(p: {
    organizationId: string;
    editionId: string;
    userIds: string[];
    actorId: string;
    ticketSource?: 'NEW' | 'OLD';
  }): Promise<IPollaEditionLiquidationResult> {
    const { data, error } = await supabase.rpc('polla_liquidate_edition_accounts', {
      p_organization_id: p.organizationId,
      p_edition_id: p.editionId,
      p_user_ids: p.userIds,
      p_actor_id: p.actorId,
      p_ticket_source: p.ticketSource ?? null,
    });

    throwIfPollaError(error);
    return data as IPollaEditionLiquidationResult;
  }

  /**
   * "Generar liquidación": carga los movimientos nuevos de cada pasador, los
   * liquida y marca la edición (si no estaba marcada), todo junto. Sin
   * `ticketSource`, si cambiaron las jugadas devuelve las diferencias sin
   * escribir nada.
   */
  async generate(p: {
    organizationId: string;
    editionId: string;
    actorId: string;
    entries: IGenerateEditionLiquidationPayload['entries'];
    ticketSource?: 'NEW' | 'OLD';
  }): Promise<IPollaEditionLiquidationResult> {
    const { data, error } = await supabase.rpc('polla_generate_edition_liquidation', {
      p_organization_id: p.organizationId,
      p_edition_id: p.editionId,
      p_actor_id: p.actorId,
      p_entries: p.entries,
      p_ticket_source: p.ticketSource ?? null,
    });

    throwIfPollaError(error);
    return data as IPollaEditionLiquidationResult;
  }

  /**
   * Marca o desmarca la edición como liquidada y devuelve la edición. Con la
   * carga abierta no se marca (`POLLA_EDITION_LOAD_OPEN`); desmarcar anda siempre.
   */
  async setLiquidated(p: {
    organizationId: string;
    editionId: string;
    actorId: string;
    liquidated: boolean;
  }): Promise<IPollaEditionEntityBack> {
    const { error } = await supabase.rpc('polla_set_edition_liquidated', {
      p_organization_id: p.organizationId,
      p_edition_id: p.editionId,
      p_actor_id: p.actorId,
      p_liquidated: p.liquidated,
    });
    throwIfPollaError(error);

    const { data, error: editionError } = await supabase
      .from('polla_editions')
      .select('*, draws:polla_edition_draws(polla_lottery_id, polla_schedule_id)')
      .eq('polla_edition_id', p.editionId)
      .eq('polla_organization_id', p.organizationId)
      .is('deleted_at', null)
      .maybeSingle();

    throwIfPollaError(editionError);
    if (!data) throw new NotFoundError('Edición de Polla');
    return data as IPollaEditionEntityBack;
  }

  /** El pasador tiene al menos una liquidación en la edición. */
  async hasLiquidation(
    organizationId: string,
    editionId: string,
    userId: string
  ): Promise<boolean> {
    const { count, error } = await supabase
      .from('polla_edition_liquidations')
      .select('polla_edition_liquidation_id', { count: 'exact', head: true })
      .eq('polla_organization_id', organizationId)
      .eq('polla_edition_id', editionId)
      .eq('polla_user_id', userId);

    throwIfPollaError(error);
    return (count ?? 0) > 0;
  }

  async movements(p: {
    organizationId: string;
    editionId: string;
    userId?: string | null;
  }): Promise<IPollaEditionAccountMovement[]> {
    let query = supabase
      .from('polla_edition_account_movements')
      .select(MOVEMENT_COLUMNS)
      .eq('polla_organization_id', p.organizationId)
      .eq('polla_edition_id', p.editionId)
      .is('deleted_at', null);

    if (p.userId) query = query.eq('polla_user_id', p.userId);

    const { data, error } = await query
      .order('date', { ascending: false })
      .order('created_at', { ascending: false });

    throwIfPollaError(error);
    return ((data ?? []) as unknown as MovementRow[]).map(toMovement);
  }

  async createMovement(
    p: IPollaAccountMovementPayload & {
      organizationId: string;
      editionId: string;
      createdBy: string;
    }
  ): Promise<IPollaEditionAccountMovement> {
    const { data, error } = await supabase
      .from('polla_edition_account_movements')
      .insert({
        polla_organization_id: p.organizationId,
        polla_edition_id: p.editionId,
        polla_user_id: p.polla_user_id,
        type: p.type,
        amount: p.amount,
        // Sin fecha, la base usa el día de hoy (`polla_today()`).
        ...(p.date ? { date: p.date } : {}),
        note: p.note ?? null,
        created_by: p.createdBy,
      })
      .select(MOVEMENT_COLUMNS)
      .single();

    throwIfPollaError(error);
    return toMovement(data as unknown as MovementRow);
  }

  /** Un movimiento de la organización que no esté borrado, o `NotFoundError`. */
  async getMovement(id: string, organizationId: string): Promise<IPollaEditionAccountMovement> {
    const { data, error } = await supabase
      .from('polla_edition_account_movements')
      .select(MOVEMENT_COLUMNS)
      .eq('polla_edition_account_movement_id', id)
      .eq('polla_organization_id', organizationId)
      .is('deleted_at', null)
      .maybeSingle();

    throwIfPollaError(error);
    if (!data) throw new NotFoundError('Movimiento');
    return toMovement(data as unknown as MovementRow);
  }

  /** El tipo no se cambia: el signo de cobros y pagos lo valida la ruta. */
  async updateMovement(
    id: string,
    organizationId: string,
    props: IPollaAccountMovementUpdatePayload,
    editedBy: string
  ): Promise<IPollaEditionAccountMovement> {
    const { data, error } = await supabase
      .from('polla_edition_account_movements')
      .update({
        ...(props.amount !== undefined ? { amount: props.amount } : {}),
        ...(props.date ? { date: props.date } : {}),
        ...(props.note !== undefined ? { note: props.note } : {}),
        edited_by: editedBy,
        edited_at: new Date().toISOString(),
      })
      .eq('polla_edition_account_movement_id', id)
      .eq('polla_organization_id', organizationId)
      .is('deleted_at', null)
      .select(MOVEMENT_COLUMNS)
      .maybeSingle();

    throwIfPollaError(error);
    if (!data) throw new NotFoundError('Movimiento');
    return toMovement(data as unknown as MovementRow);
  }

  async deleteMovement(id: string, organizationId: string, deletedBy: string): Promise<void> {
    const { data, error } = await supabase
      .from('polla_edition_account_movements')
      .update({ deleted_at: new Date().toISOString(), deleted_by: deletedBy })
      .eq('polla_edition_account_movement_id', id)
      .eq('polla_organization_id', organizationId)
      .is('deleted_at', null)
      .select('polla_edition_account_movement_id')
      .maybeSingle();

    throwIfPollaError(error);
    if (!data) throw new NotFoundError('Movimiento');
  }

  async totals(p: {
    organizationId: string;
    editionIds: string[];
    groupId?: string | null;
  }): Promise<IPollaEditionAccountTotals[]> {
    const { data, error } = await supabase.rpc('polla_edition_account_totals', {
      p_organization_id: p.organizationId,
      p_edition_ids: p.editionIds,
      p_group_id: p.groupId ?? null,
    });

    throwIfPollaError(error);
    return data ?? [];
  }

  /** Ediciones donde el pasador tiene liquidación, con su cuenta. */
  async userAccounts(
    organizationId: string,
    userId: string
  ): Promise<{ polla_edition_id: string; account: IPollaEditionAccountRow }[]> {
    const { data, error } = await supabase.rpc('polla_user_edition_accounts', {
      p_organization_id: organizationId,
      p_user_id: userId,
    });

    throwIfPollaError(error);
    return data ?? [];
  }

  async liquidateGroup(p: {
    organizationId: string;
    groupId: string;
    editionId: string;
    /** null: el del admin (si no tiene, la base lo rechaza). */
    percentage: number | null;
    adjustments: number;
    paid: number;
    actorId: string;
  }): Promise<IPollaGroupEditionAccountEntity> {
    const { data, error } = await supabase.rpc('polla_liquidate_group_edition', {
      p_organization_id: p.organizationId,
      p_group_id: p.groupId,
      p_edition_id: p.editionId,
      p_percentage: p.percentage,
      p_adjustments: p.adjustments,
      p_paid: p.paid,
      p_actor_id: p.actorId,
    });

    throwIfPollaError(error);
    return data as IPollaGroupEditionAccountEntity;
  }

  /** Varios grupos en una transacción: si uno falla, no se liquida ninguno. */
  async liquidateGroups(p: {
    organizationId: string;
    editionId: string;
    groups: { polla_group_id: string; admin_percentage?: number | null }[];
    actorId: string;
  }): Promise<IPollaGroupEditionAccountEntity[]> {
    const { data, error } = await supabase.rpc('polla_liquidate_group_editions', {
      p_organization_id: p.organizationId,
      p_edition_id: p.editionId,
      p_entries: p.groups.map((g) => ({
        polla_group_id: g.polla_group_id,
        admin_percentage: g.admin_percentage ?? null,
      })),
      p_actor_id: p.actorId,
    });

    throwIfPollaError(error);
    return (data ?? []) as IPollaGroupEditionAccountEntity[];
  }

  /** Cuentas de grupo ya liquidadas, filtradas por edición y/o grupo. */
  async groupAccounts(f: {
    organizationId: string;
    editionId?: string | null;
    groupId?: string | null;
  }): Promise<IPollaGroupEditionAccountEntity[]> {
    let query = supabase
      .from('polla_group_edition_accounts')
      .select('*')
      .eq('polla_organization_id', f.organizationId);

    if (f.editionId) query = query.eq('polla_edition_id', f.editionId);
    if (f.groupId) query = query.eq('polla_group_id', f.groupId);

    const { data, error } = await query.order('group_name', { ascending: true });

    throwIfPollaError(error);
    return (data ?? []) as IPollaGroupEditionAccountEntity[];
  }
}
