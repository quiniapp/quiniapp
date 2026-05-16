import { ICleanupResult, SettingsRepository } from '../repository/settings.repository';

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

  cleanupOldArchiveData = async (): Promise<ICleanupResult> => {
    try {
      return await this.repository.cleanupOldArchiveData(65);
    } catch (error) {
      console.error('cleanupOldArchiveData error:', error);
      throw error instanceof Error ? error : new Error('Unknown error');
    }
  };
}
