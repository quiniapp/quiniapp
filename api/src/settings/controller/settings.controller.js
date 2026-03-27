import { SettingsRepository } from '../repository/settings.repository';
export class SettingsController {
    constructor() {
        this.repository = new SettingsRepository();
        this.getStorageStatus = async () => {
            try {
                return await this.repository.getStorageStatus();
            }
            catch (error) {
                console.error('getStorageStatus error:', error);
                throw error instanceof Error ? error : new Error('Unknown error');
            }
        };
    }
}
