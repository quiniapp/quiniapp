import { supabase } from '@database/db.connection';
export class ActivityDaysRepository {
    /**
     * Mark a specific date as active
     */
    async markDayAsActive(date) {
        const { error } = await supabase.rpc('mark_day_as_active', {
            p_date: date,
        });
        if (error) {
            throw new Error(`Failed to mark day as active: ${error.message}`);
        }
    }
    /**
     * Update activity counts for a specific date
     * This counts actual bets and tickets for that date
     */
    async updateActivityCounts(date) {
        const { error } = await supabase.rpc('update_activity_counts', {
            p_date: date,
        });
        if (error) {
            throw new Error(`Failed to update activity counts: ${error.message}`);
        }
    }
    /**
     * Get the last N active days (ordered by date DESC)
     */
    async getLastActiveDays(limit = 2) {
        const { data, error } = await supabase.rpc('get_last_active_days', {
            p_limit: limit,
        });
        if (error) {
            throw new Error(`Failed to get last active days: ${error.message}`);
        }
        if (!data)
            return [];
        // SP returns TABLE(date DATE), so Supabase returns [{date: 'YYYY-MM-DD'}, ...]
        return data.map((row) => typeof row === 'string' ? row.substring(0, 10) : String(row.date).substring(0, 10));
    }
    /**
     * Check if a date should be archived (older than last N active days)
     */
    async shouldArchiveDate(date, daysToKeep = 2) {
        const { data, error } = await supabase.rpc('should_archive_date', {
            p_date: date,
            p_days_to_keep: daysToKeep,
        });
        if (error) {
            throw new Error(`Failed to check if date should be archived: ${error.message}`);
        }
        return data || false;
    }
    /**
     * Get all activity days (for debugging/admin purposes)
     */
    async getAllActivityDays() {
        const { data, error } = await supabase
            .from('activity_days')
            .select('*')
            .order('date', { ascending: false });
        if (error) {
            throw new Error(`Failed to get all activity days: ${error.message}`);
        }
        return data || [];
    }
    /**
     * Get activity days with activity only
     */
    async getActiveDaysOnly() {
        const { data, error } = await supabase
            .from('activity_days')
            .select('*')
            .eq('has_activity', true)
            .order('date', { ascending: false });
        if (error) {
            throw new Error(`Failed to get active days: ${error.message}`);
        }
        return data || [];
    }
    /**
     * Get cutoff date (the date before which data should be archived)
     * Returns the Nth most recent active day
     */
    async getCutoffDate(daysToKeep = 2) {
        const activeDays = await this.getLastActiveDays(daysToKeep);
        if (activeDays.length < daysToKeep) {
            // Not enough active days to determine cutoff
            return null;
        }
        // Return the oldest date among the N most recent active days
        return activeDays[activeDays.length - 1];
    }
    /**
     * Manually create or update activity day record
     * This is a fallback for when stored procedures are not available
     */
    async upsertActivityDay(date, hasActivity, betsCount, ticketsCount) {
        const { error } = await supabase.from('activity_days').upsert({
            date,
            has_activity: hasActivity,
            bets_count: betsCount,
            tickets_count: ticketsCount,
            updated_at: new Date().toISOString(),
        }, {
            onConflict: 'date',
        });
        if (error) {
            throw new Error(`Failed to upsert activity day: ${error.message}`);
        }
    }
}
