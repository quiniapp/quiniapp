import { supabase } from '@database/db.connection';
export class ScheduleLotteryRepository {
    async getAllScheduleLottery(organization_id) {
        const { data, error } = await supabase
            .from('schedule_lotteries')
            .select('day,*')
            .eq('organization_id', organization_id);
        if (error)
            throw new Error(error.message);
        return data;
    }
    async deleteAllForScheduleAndDay({ organization_id, day, schedule_id, }) {
        const { error } = await supabase
            .from('schedule_lotteries')
            .delete()
            .match({ schedule_id, day, organization_id });
        if (error)
            throw new Error(error.message);
        return;
    }
    async bulkInsert(records) {
        const { error } = await supabase.from('schedule_lotteries').insert(records);
        if (error)
            throw new Error(error.message);
    }
    async saveScheduleLottery(scheduleLottery, organization_id) {
        const { error } = await supabase.rpc('save_schedule_lottery', {
            p_schedule_lottery: scheduleLottery,
            p_organization_id: organization_id,
        });
        if (error)
            throw new Error(error.message);
    }
    async bulkActiveLotteries(lotteries, organization_id) {
        const { error } = await supabase.rpc('update_active_lotteries', {
            lottery_ids: lotteries,
            p_organization_id: organization_id,
        });
        if (error)
            throw new Error(error.message);
    }
    async getScheduleLotteriesByDay(organization_id, day) {
        const { data, error } = await supabase
            .from('schedule_lotteries')
            .select('*')
            .eq('organization_id', organization_id)
            .eq('day', day);
        if (error)
            throw new Error(error.message);
        return data;
    }
    async getScheduleLotteriesByScheduleAndDay(organization_id, schedule_id, day) {
        const { data, error } = await supabase
            .from('schedule_lotteries')
            .select('*')
            .eq('organization_id', organization_id)
            .eq('schedule_id', schedule_id)
            .eq('day', day);
        if (error)
            throw new Error(error.message);
        return data;
    }
}
