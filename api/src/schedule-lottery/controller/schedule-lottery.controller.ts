import { ScheduleLotteryRepository } from '../repository/schedule-lottery.repositroy';

export class ScheduleLotteryController {
  private repository = new ScheduleLotteryRepository();

  async deleteAllForScheduleAndDay(schedule_id: string, day: number) {
    return await this.repository.deleteAllForScheduleAndDay(schedule_id, day);
  }

  async bulkInsert(schedule_id: string, day: number, lotteries: string[]) {
    const records = lotteries.map((lottery_id) => ({
      schedule_id,
      lottery_id,
      day,
    }));
    return await this.repository.bulkInsert(records);
  }
}
