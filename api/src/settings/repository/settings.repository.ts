import { supabase } from '@database/db.connection';

export interface ICleanupBatchResult {
  cutoff_date: string;
  bets_deleted: number;
  tickets_deleted: number;
  done: boolean;
}

export class SettingsRepository {
  async getStorageStatus(): Promise<number> {
    const { data, error } = await supabase.from('total_storage_view').select('total_gb').single();

    if (error) {
      throw new Error(error.message);
    }

    return data.total_gb;
  }

  /** Borra un solo lote; el caller repite hasta `done` (ver cleanup_old_archive_data_batch). */
  async cleanupOldArchiveDataBatch(days: number, batchSize: number): Promise<ICleanupBatchResult> {
    const { data, error } = await supabase.rpc('cleanup_old_archive_data_batch', {
      p_days: days,
      p_batch_size: batchSize,
    });

    if (error) {
      throw new Error(error.message);
    }

    return data as ICleanupBatchResult;
  }
}
