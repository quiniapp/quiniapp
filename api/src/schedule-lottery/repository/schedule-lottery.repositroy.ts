import { supabase } from '@database/db.connection';
import { IScheduleLotteryEntityBack, SCHEDULE_DAY } from '@helper/types/schedule-lottery.type';

export class ScheduleLotteryRepository {
  async getAllScheduleLottery(): Promise<IScheduleLotteryEntityBack[]> {
    const { data, error } = await supabase.from('schedule_lotteries').select('day,*');

    if (error) throw new Error(error.message);

    return data;
  }

  async deleteAllForScheduleAndDay({
    day,
    schedule_id,
  }: {
    day: SCHEDULE_DAY;
    schedule_id: string;
  }) {
    const { error } = await supabase
      .from('schedule_lotteries')
      .delete()
      .match({ schedule_id, day });

    if (error) throw new Error(error.message);

    // count es un number, puede ser 0 si no borró nada
    return;
  }

  async bulkInsert(
    records: {
      day: SCHEDULE_DAY;
      schedule_id: string;
      lottery_id: string;
    }[]
  ) {
    const { error } = await supabase.from('schedule_lotteries').insert(records);

    if (error) throw new Error(error.message);
  }
}
