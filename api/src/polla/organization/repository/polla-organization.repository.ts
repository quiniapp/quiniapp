import { supabase } from '@database/db.connection';
import { IPollaOrganizationEntityBack } from '@helper/polla/types/catalog.type';
import { throwIfPollaError } from '../../helper/polla-errors';

export interface NewCapitalistRow {
  name: string;
  last_name?: string | null;
  username: string;
  email?: string | null;
  phone?: number | null;
  password_hash: string;
}

export class PollaOrganizationRepository {
  /** Organización y capitalista en una sola transacción (si falla uno, no queda ninguno). */
  async createWithCapitalist(name: string, capitalist: NewCapitalistRow) {
    const { data, error } = await supabase.rpc('polla_create_organization_with_capitalist', {
      p_name: name,
      p_capitalist: capitalist,
    });

    throwIfPollaError(error);
    return data as { organization: IPollaOrganizationEntityBack; capitalist_polla_user_id: string };
  }
}
