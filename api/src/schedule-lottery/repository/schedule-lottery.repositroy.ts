import { supabase } from 'api/database/db.connection';

export class ScheduleLotteryRepository {
  async deleteAllForScheduleAndDay(schedule_id: string, day: number) {
    const { error } = await supabase
      .from('schedule_lotteries')
      .delete()
      .match({ schedule_id, day });

    if (error) throw new Error(error.message);
  }

  async bulkInsert(
    records: {
      schedule_id: string;
      lottery_id: string;
      day: number;
    }[]
  ) {
    const { error } = await supabase.from('schedule_lotteries').insert(records);

    if (error) throw new Error(error.message);
  }
}
