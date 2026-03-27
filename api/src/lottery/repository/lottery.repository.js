import { supabase } from '@database/db.connection';
import dayjs from 'dayjs';
export class LotteryRepository {
    async getById(id, organization_id) {
        const { data, error } = await supabase
            .from('lotteries')
            .select('*')
            .eq('lottery_id', id)
            .eq('organization_id', organization_id)
            .single();
        if (error)
            throw new Error(error.details);
        return data;
    }
    async getAll(organization_id, all) {
        let query = supabase
            .from('lotteries')
            .select('*')
            .eq('organization_id', organization_id)
            .is('deleted_at', null);
        if (!all) {
            query = query.eq('active', true);
        }
        const { data, error } = await query.order('order', { ascending: true });
        if (error)
            throw new Error(error.details);
        return data;
    }
    async create(payload) {
        const { data, error } = await supabase.from('lotteries').insert(payload).select().single();
        if (error)
            throw new Error(error.details);
        return data;
    }
    async update(id, payload, organization_id) {
        const timestamp = dayjs().toISOString();
        const { data, error } = await supabase
            .from('lotteries')
            .update({ ...payload, edited_at: timestamp })
            .eq('lottery_id', id)
            .eq('organization_id', organization_id)
            .select()
            .single();
        if (error)
            throw new Error(error.details);
        return data;
    }
    async delete(id, organization_id) {
        const timestamp = dayjs().toISOString();
        const { error } = await supabase
            .from('lotteries')
            .update({ deleted_at: timestamp })
            .eq('lottery_id', id)
            .eq('organization_id', organization_id);
        if (error)
            throw new Error(error.details);
    }
    async getNextOrder(organization_id) {
        const { data, error } = await supabase
            .from('lotteries')
            .select('order')
            .eq('organization_id', organization_id)
            .is('deleted_at', null)
            .order('order', { ascending: false })
            .limit(1)
            .single();
        if (error) {
            // If no lotteries exist yet, start with 0
            if (error.code === 'PGRST116')
                return 0;
            throw new Error(error.details);
        }
        return (data?.order ?? -1) + 1;
    }
}
