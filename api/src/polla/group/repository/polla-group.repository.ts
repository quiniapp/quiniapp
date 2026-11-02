import { supabase } from '@database/db.connection';
import { IPollaGroupEntityBack } from '@helper/polla/types/catalog.type';
import { throwIfPollaError } from '../../helper/polla-errors';

export interface NewGroupAdminRow {
  name: string;
  last_name?: string | null;
  username: string;
  email?: string | null;
  phone?: number | null;
  password_hash: string;
}

export class PollaGroupRepository {
  /** Grupo y admin en una sola transacción (si falla uno, no queda ninguno). */
  async createWithAdmin(organizationId: string, name: string, admin: NewGroupAdminRow) {
    const { data, error } = await supabase.rpc('polla_create_group_with_admin', {
      p_organization_id: organizationId,
      p_name: name,
      p_admin: admin,
    });

    throwIfPollaError(error);
    return data as { group: IPollaGroupEntityBack; admin_polla_user_id: string };
  }

  /**
   * Borra el grupo con su admin, pasadores y jugadores. La base lo rechaza si
   * hay jugadas en ediciones en juego o algo sin liquidar.
   */
  async remove(groupId: string, actorId: string) {
    const { data, error } = await supabase.rpc('polla_delete_group', {
      p_group_id: groupId,
      p_actor_id: actorId,
    });

    throwIfPollaError(error);
    return data as { success: boolean; deleted_users: number };
  }
}
