import { parseScheduleLottery } from '../helper/parseScheduleLottery';
import { ScheduleLotteryRepository } from '../repository/schedule-lottery.repositroy';
export class ScheduleLotteryController {
    constructor() {
        this.repository = new ScheduleLotteryRepository();
    }
    async getAllScheduleLotteries(organization_id) {
        const response = await this.repository.getAllScheduleLottery(organization_id);
        return parseScheduleLottery(response);
    }
    async deleteAllForScheduleAndDay({ day, schedule_id, organization_id, }) {
        try {
            return await this.repository.deleteAllForScheduleAndDay({
                day,
                schedule_id,
                organization_id,
            });
        }
        catch (error) {
            console.error('getAllLotterySchedules:', error);
            throw error instanceof Error ? error : new Error('Unknown error');
        }
    }
    async bulkInsert(props, organization_id) {
        try {
            await this.repository.bulkInsert(props);
            return await this.getAllScheduleLotteries(organization_id);
        }
        catch (error) {
            console.error('bulkInsert:', error);
            throw error instanceof Error ? error : new Error('Unknown error');
        }
    }
    async bulkActiveLotteries(lotteries, organization_id) {
        try {
            await this.repository.bulkActiveLotteries(lotteries, organization_id);
        }
        catch (error) {
            console.error('bulkInsert:', error);
            throw error instanceof Error ? error : new Error('Unknown error');
        }
    }
    async saveScheduleLottery(scheduleLottery, organization_id) {
        try {
            // Use RPC function for atomic save
            await this.repository.saveScheduleLottery(scheduleLottery, organization_id);
            // Extract all lottery IDs to activate
            const lotteries = [];
            for (const daySchedules of Object.values(scheduleLottery)) {
                for (const lotteryIds of Object.values(daySchedules ?? {})) {
                    for (const id of lotteryIds) {
                        if (!lotteries.includes(id))
                            lotteries.push(id);
                    }
                }
            }
            // Activate lotteries
            if (lotteries.length > 0) {
                await this.repository.bulkActiveLotteries(lotteries, organization_id);
            }
            // Return fresh data
            return await this.getAllScheduleLotteries(organization_id);
        }
        catch (error) {
            console.error('saveScheduleLottery:', error);
            throw error instanceof Error ? error : new Error('Unknown error');
        }
    }
    async getLotteryIdsForDay(organization_id, day) {
        try {
            const records = await this.repository.getScheduleLotteriesByDay(organization_id, day);
            const lotteryIds = records.map((record) => record.lottery_id);
            // Return unique lottery IDs
            return [...new Set(lotteryIds)];
        }
        catch (error) {
            console.error('getLotteryIdsForDay:', error);
            throw error instanceof Error ? error : new Error('Unknown error');
        }
    }
    async getScheduleIdsForDay(organization_id, day) {
        try {
            const records = await this.repository.getScheduleLotteriesByDay(organization_id, day);
            const scheduleIds = records.map((record) => record.schedule_id);
            // Return unique schedule IDs
            return [...new Set(scheduleIds)];
        }
        catch (error) {
            console.error('getScheduleIdsForDay:', error);
            throw error instanceof Error ? error : new Error('Unknown error');
        }
    }
    async getLotteryIdsByScheduleAndDay(organization_id, schedule_id, day) {
        try {
            const records = await this.repository.getScheduleLotteriesByScheduleAndDay(organization_id, schedule_id, day);
            return records.map((record) => record.lottery_id);
        }
        catch (error) {
            console.error('getLotteryIdsByScheduleAndDay:', error);
            throw error instanceof Error ? error : new Error('Unknown error');
        }
    }
}
