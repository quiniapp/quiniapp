import { supabase } from '@database/db.connection';
import { ActivityDaysRepository } from '../../activity/repository/activity-days.repository';

export interface IArchiveResult {
  success: boolean;
  message: string;
  cutoff_date: string | null;
  archived_count: number;
  deleted_count: number;
  days_kept: number;
}

export interface IArchiveStats {
  main_tables: {
    bets_count: number;
    tickets_count: number;
  };
  archive_tables: {
    bets_count: number;
    tickets_count: number;
  };
  activity: {
    active_days_count: number;
    last_active_date: string | null;
  };
  compression_ratio: {
    bets: number;
    tickets: number;
  };
}

export class ArchiveService {
  private activityDaysRepo: ActivityDaysRepository;

  constructor() {
    this.activityDaysRepo = new ActivityDaysRepository();
  }

  /**
   * Archive old bets (older than N active days)
   * Uses stored procedure if available, fallback to TypeScript implementation
   */
  async archiveOldBets(daysToKeep: number = 2): Promise<IArchiveResult> {
    try {
      // Try using stored procedure first (performance optimization)
      const { data, error } = await supabase.rpc('archive_old_bets', {
        p_days_to_keep: daysToKeep,
      });

      if (error) {
        console.warn('Stored procedure failed, using TypeScript fallback:', error.message);
        return await this.archiveOldBetsManual(daysToKeep);
      }

      return data as IArchiveResult;
    } catch (err) {
      console.error('Error archiving bets:', err);
      throw err;
    }
  }

  /**
   * Archive old tickets (older than N active days)
   * Uses stored procedure if available, fallback to TypeScript implementation
   */
  async archiveOldTickets(daysToKeep: number = 2): Promise<IArchiveResult> {
    try {
      // Try using stored procedure first (performance optimization)
      const { data, error } = await supabase.rpc('archive_old_tickets', {
        p_days_to_keep: daysToKeep,
      });

      if (error) {
        console.warn('Stored procedure failed, using TypeScript fallback:', error.message);
        return await this.archiveOldTicketsManual(daysToKeep);
      }

      return data as IArchiveResult;
    } catch (err) {
      console.error('Error archiving tickets:', err);
      throw err;
    }
  }

  /**
   * Archive both bets and tickets in a single operation
   */
  async archiveOldData(daysToKeep: number = 2): Promise<{
    success: boolean;
    bets: IArchiveResult;
    tickets: IArchiveResult;
    execution_time_ms?: number;
  }> {
    try {
      // Try using stored procedure first (more efficient - single transaction)
      const { data, error } = await supabase.rpc('archive_old_data', {
        p_days_to_keep: daysToKeep,
      });

      if (error) {
        console.warn('Stored procedure failed, using TypeScript fallback:', error.message);
        return await this.archiveOldDataManual(daysToKeep);
      }

      return data;
    } catch (err) {
      console.error('Error archiving data:', err);
      throw err;
    }
  }

  /**
   * Get archive statistics
   */
  async getArchiveStats(): Promise<IArchiveStats> {
    try {
      const { data, error } = await supabase.rpc('get_archive_stats');

      if (error) {
        console.warn('Stored procedure failed, calculating stats manually:', error.message);
        return await this.getArchiveStatsManual();
      }

      return data as IArchiveStats;
    } catch (err) {
      console.error('Error getting archive stats:', err);
      throw err;
    }
  }

  /**
   * Manual implementation of archiving bets (fallback)
   * This is database-agnostic and can be used if stored procedures fail
   */
  private async archiveOldBetsManual(daysToKeep: number): Promise<IArchiveResult> {
    const cutoffDate = await this.activityDaysRepo.getCutoffDate(daysToKeep);

    if (!cutoffDate) {
      return {
        success: true,
        message: 'Not enough active days to archive',
        cutoff_date: null,
        archived_count: 0,
        deleted_count: 0,
        days_kept: daysToKeep,
      };
    }

    // Get old bets (INCLUDING deleted ones)
    const { data: oldBets, error: selectError } = await supabase
      .from('bets')
      .select('*')
      .lt('date', cutoffDate);
    // Note: Gets ALL bets (deleted_at IS NULL AND deleted_at IS NOT NULL)

    if (selectError) {
      const errorMsg =
        typeof selectError.message === 'string' ? selectError.message : JSON.stringify(selectError);
      throw new Error(`Failed to select old bets: ${errorMsg}`);
    }

    if (!oldBets || oldBets.length === 0) {
      return {
        success: true,
        message: 'No bets to archive',
        cutoff_date: cutoffDate,
        archived_count: 0,
        deleted_count: 0,
        days_kept: daysToKeep,
      };
    }

    // Insert into archive
    const betsToArchive = oldBets.map((bet) => ({
      ...bet,
      archived_at: new Date().toISOString(),
    }));

    const { error: insertError } = await supabase.from('bets_archive').insert(betsToArchive);

    if (insertError) {
      const errorMsg =
        typeof insertError.message === 'string' ? insertError.message : JSON.stringify(insertError);
      throw new Error(`Failed to insert bets into archive: ${errorMsg}`);
    }

    // Delete from main table (INCLUDING deleted ones)
    const { error: deleteError } = await supabase.from('bets').delete().lt('date', cutoffDate);
    // Note: Deletes ALL archived bets (deleted_at IS NULL AND deleted_at IS NOT NULL)

    if (deleteError) {
      const errorMsg =
        typeof deleteError.message === 'string' ? deleteError.message : JSON.stringify(deleteError);
      throw new Error(`Failed to delete archived bets: ${errorMsg}`);
    }

    return {
      success: true,
      message: 'Bets archived successfully',
      cutoff_date: cutoffDate,
      archived_count: oldBets.length,
      deleted_count: oldBets.length,
      days_kept: daysToKeep,
    };
  }

  /**
   * Manual implementation of archiving tickets (fallback)
   */
  private async archiveOldTicketsManual(daysToKeep: number): Promise<IArchiveResult> {
    const cutoffDate = await this.activityDaysRepo.getCutoffDate(daysToKeep);

    if (!cutoffDate) {
      return {
        success: true,
        message: 'Not enough active days to archive',
        cutoff_date: null,
        archived_count: 0,
        deleted_count: 0,
        days_kept: daysToKeep,
      };
    }

    // Get old tickets (INCLUDING deleted ones)
    const { data: oldTickets, error: selectError } = await supabase
      .from('tickets')
      .select('*')
      .lt('date', cutoffDate);
    // Note: Gets ALL tickets (deleted_at IS NULL AND deleted_at IS NOT NULL)

    if (selectError) {
      const errorMsg =
        typeof selectError.message === 'string' ? selectError.message : JSON.stringify(selectError);
      throw new Error(`Failed to select old tickets: ${errorMsg}`);
    }

    if (!oldTickets || oldTickets.length === 0) {
      return {
        success: true,
        message: 'No tickets to archive',
        cutoff_date: cutoffDate,
        archived_count: 0,
        deleted_count: 0,
        days_kept: daysToKeep,
      };
    }

    // Insert into archive
    const ticketsToArchive = oldTickets.map((ticket) => ({
      ...ticket,
      archived_at: new Date().toISOString(),
    }));

    const { error: insertError } = await supabase.from('tickets_archive').insert(ticketsToArchive);

    if (insertError) {
      const errorMsg =
        typeof insertError.message === 'string' ? insertError.message : JSON.stringify(insertError);
      throw new Error(`Failed to insert tickets into archive: ${errorMsg}`);
    }

    // Delete from main table (INCLUDING deleted ones)
    const { error: deleteError } = await supabase.from('tickets').delete().lt('date', cutoffDate);
    // Note: Deletes ALL archived tickets (deleted_at IS NULL AND deleted_at IS NOT NULL)

    if (deleteError) {
      const errorMsg =
        typeof deleteError.message === 'string' ? deleteError.message : JSON.stringify(deleteError);
      throw new Error(`Failed to delete archived tickets: ${errorMsg}`);
    }

    return {
      success: true,
      message: 'Tickets archived successfully',
      cutoff_date: cutoffDate,
      archived_count: oldTickets.length,
      deleted_count: oldTickets.length,
      days_kept: daysToKeep,
    };
  }

  /**
   * Manual implementation of archiving both bets and tickets
   */
  private async archiveOldDataManual(daysToKeep: number): Promise<{
    success: boolean;
    bets: IArchiveResult;
    tickets: IArchiveResult;
    execution_time_ms?: number;
  }> {
    const startTime = Date.now();

    const betsResult = await this.archiveOldBetsManual(daysToKeep);
    const ticketsResult = await this.archiveOldTicketsManual(daysToKeep);

    const executionTime = Date.now() - startTime;

    return {
      success: true,
      bets: betsResult,
      tickets: ticketsResult,
      execution_time_ms: executionTime,
    };
  }

  /**
   * Manual implementation of getting archive stats
   */
  private async getArchiveStatsManual(): Promise<IArchiveStats> {
    // Count main tables (ALL rows, including deleted)
    const { count: betsMainCount } = await supabase
      .from('bets')
      .select('*', { count: 'exact', head: true });

    const { count: ticketsMainCount } = await supabase
      .from('tickets')
      .select('*', { count: 'exact', head: true });

    // Count archive tables
    const { count: betsArchiveCount } = await supabase
      .from('bets_archive')
      .select('*', { count: 'exact', head: true });

    const { count: ticketsArchiveCount } = await supabase
      .from('tickets_archive')
      .select('*', { count: 'exact', head: true });

    // Get activity info
    const activeDays = await this.activityDaysRepo.getActiveDaysOnly();

    const lastActiveDay = activeDays.length > 0 ? activeDays[0].date : null;

    // Calculate compression ratios
    const betsTotal = (betsMainCount || 0) + (betsArchiveCount || 0);
    const ticketsTotal = (ticketsMainCount || 0) + (ticketsArchiveCount || 0);

    const betsRatio = betsTotal > 0 ? ((betsArchiveCount || 0) / betsTotal) * 100 : 0;
    const ticketsRatio = ticketsTotal > 0 ? ((ticketsArchiveCount || 0) / ticketsTotal) * 100 : 0;

    return {
      main_tables: {
        bets_count: betsMainCount || 0,
        tickets_count: ticketsMainCount || 0,
      },
      archive_tables: {
        bets_count: betsArchiveCount || 0,
        tickets_count: ticketsArchiveCount || 0,
      },
      activity: {
        active_days_count: activeDays.length,
        last_active_date: lastActiveDay,
      },
      compression_ratio: {
        bets: Math.round(betsRatio * 100) / 100,
        tickets: Math.round(ticketsRatio * 100) / 100,
      },
    };
  }
}
