import { supabase } from '@database/db.connection';

export class SettingsRepository {
  async getStorageStatus(): Promise<number> {
    const { data, error } = await supabase
      .from('total_storage_view') // El nombre de tu VIEW
      .select('total_gb')
      .single(); // .single() porque sabemos que solo es una fila
    console.log(error);
    if (error) {
      throw new Error(error.message);
    }

    return data.total_gb;
  }
}
