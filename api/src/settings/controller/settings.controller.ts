import { ICleanupBatchResult, SettingsRepository } from '../repository/settings.repository';

const CLEANUP_DAYS = 65;
// Cada request tiene que volver antes del timeout de 4s del proxy de Vercel.
const CLEANUP_BATCH_SIZE = 5000;

export class SettingsController {
  private repository = new SettingsRepository();

  getStorageStatus = async (): Promise<number> => {
    try {
      return await this.repository.getStorageStatus();
    } catch (error) {
      console.error('getStorageStatus error:', error);
      throw error instanceof Error ? error : new Error('Unknown error');
    }
  };

  cleanupOldArchiveDataBatch = async (): Promise<ICleanupBatchResult> => {
    try {
      return await this.repository.cleanupOldArchiveDataBatch(CLEANUP_DAYS, CLEANUP_BATCH_SIZE);
    } catch (error) {
      console.error('cleanupOldArchiveDataBatch error:', error);
      throw error instanceof Error ? error : new Error('Unknown error');
    }
  };
}
