import { supabase } from '@database/db.connection';
import { IScheduleLotteryEntityBack, SCHEDULE_DAY } from '@helper/types/schedule-lottery.type';

export class ScheduleLotteryRepository {
  async getAllScheduleLottery(organization_id: string): Promise<IScheduleLotteryEntityBack[]> {
    const { data, error } = await supabase
      .from('schedule_lotteries')
      .select('day,*')
      .eq('organization_id', organization_id);

    if (error) throw new Error(error.message);

    return data;
  }

  async deleteAllForScheduleAndDay({
    organization_id,
    day,
    schedule_id,
  }: {
    organization_id: string;
    day: SCHEDULE_DAY;
    schedule_id: string;
  }) {
    const { error } = await supabase
      .from('schedule_lotteries')
      .delete()
      .match({ schedule_id, day, organization_id });

    if (error) throw new Error(error.message);

    return;
  }

  async bulkInsert(
    records: {
      organization_id: string;
      day: SCHEDULE_DAY;
      schedule_id: string;
      lottery_id: string;
    }[]
  ) {
    const { error } = await supabase.from('schedule_lotteries').insert(records);

    if (error) throw new Error(error.message);
  }

  async bulkActiveLotteries(lotteries: string[], organization_id: string) {
    const { error } = await supabase.rpc('update_active_lotteries', {
      lottery_ids: lotteries,
      p_organization_id: organization_id,
    });

    if (error) throw new Error(error.message);
  }
}
