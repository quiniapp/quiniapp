import { ScheduleRepository } from '../repository/schedule.repository';
import { scheduleBase } from '../helper/scheduleBase';
import { parseSchedule } from '../helper/parseSchedule';
import { ScheduleLotteryController } from '../../schedule-lottery/controller/schedule-lottery.controller';
export class ScheduleController {
    constructor() {
        this.repository = new ScheduleRepository();
        this.scheduleLotteryController = new ScheduleLotteryController();
        this.create = async (props, organization_id) => {
            try {
                const newSchedule = scheduleBase(props, organization_id);
                const schedule = await this.repository.create(newSchedule);
                return parseSchedule(schedule);
            }
            catch (error) {
                console.error('Controller creation error:', error);
                throw error instanceof Error ? error : new Error('Unknown error');
            }
        };
        this.get = async (props, organization_id) => {
            try {
                const schedule = await this.repository.getById(props.schedule_id, organization_id);
                return parseSchedule(schedule);
            }
            catch (error) {
                console.error('Get error:', error);
                throw error instanceof Error ? error : new Error('Unknown error');
            }
        };
        this.getAll = async (organization_id, all) => {
            try {
                const schedules = await this.repository.getAll(organization_id, all);
                return schedules.map((schedule) => {
                    return parseSchedule(schedule);
                });
            }
            catch (error) {
                console.error('GetAll error:', error);
                throw error instanceof Error ? error : new Error('Unknown error');
            }
        };
        this.getAllByDay = async (day, all, organization_id, withLotteries = false) => {
            try {
                // Get schedule IDs that have lotteries configured for this day
                const scheduleIds = await this.scheduleLotteryController.getScheduleIdsForDay(organization_id, day);
                // Get all schedules
                const allSchedules = await this.repository.getAll(organization_id, all);
                // Filter schedules by IDs that have lotteries configured for this day
                const filteredSchedules = allSchedules.filter((schedule) => scheduleIds.includes(schedule.schedule_id));
                // Parse schedules
                const parsedSchedules = filteredSchedules.map((schedule) => parseSchedule(schedule));
                // If withLotteries is true, include lottery_ids for each schedule
                if (withLotteries) {
                    const schedulesWithLotteries = await Promise.all(parsedSchedules.map(async (schedule) => {
                        const lotteryIds = await this.scheduleLotteryController.getLotteryIdsByScheduleAndDay(organization_id, schedule.schedule_id, day);
                        return {
                            ...schedule,
                            lottery_ids: lotteryIds,
                        };
                    }));
                    return schedulesWithLotteries;
                }
                return parsedSchedules;
            }
            catch (error) {
                console.error('getAllByDay error:', error);
                throw error instanceof Error ? error : new Error('Unknown error');
            }
        };
        this.update = async (id, props, organization_id) => {
            try {
                const schedule = await this.repository.update(id, props, organization_id);
                return parseSchedule(schedule);
            }
            catch (error) {
                console.error('Update error:', error);
                throw error instanceof Error ? error : new Error('Unknown error');
            }
        };
        this.delete = async (props, organization_id) => {
            try {
                await this.repository.delete(props.schedule_id, organization_id);
                return;
            }
            catch (error) {
                console.error('Delete error:', error);
                throw error instanceof Error ? error : new Error('Unknown error');
            }
        };
    }
}
