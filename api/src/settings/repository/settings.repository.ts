import { supabase } from '@database/db.connection';

export interface ICleanupResult {
  success: boolean;
  cutoff_date: string;
  bets_deleted: number;
  tickets_deleted: number;
}

export class SettingsRepository {
  async getStorageStatus(): Promise<number> {
    const { data, error } = await supabase.from('total_storage_view').select('total_gb').single();

    if (error) {
      throw new Error(error.message);
    }

    return data.total_gb;
  }

  async cleanupOldArchiveData(days: number = 65): Promise<ICleanupResult> {
    const { data, error } = await supabase.rpc('cleanup_old_archive_data', { p_days: days });

    if (error) {
      throw new Error(error.message);
    }

    return data as ICleanupResult;
  }
}
