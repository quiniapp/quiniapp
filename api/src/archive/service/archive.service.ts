import { supabase } from '@database/db.connection';
import { ActivityDaysRepository } from '../../activity/repository/activity-days.repository';

export interface IArchiveDayResult {
  date: string;
  bets_archived: number;
  tickets_archived: number;
  success: boolean;
}

export interface IArchiveJobResult {
  success: boolean;
  cutoff_date: string;
  days_attempted: number;
  days_succeeded: number;
  failed_at?: string;
  error?: string;
  days: IArchiveDayResult[];
  execution_time_ms: number;
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
   * Archive all data older than the cutoff date, one day at a time.
   * Calls archive_data_by_date RPC per day so no single call can timeout.
   * Iterates from oldest to newest and stops on the first failure.
   */
  async archiveOldData(daysToKeep: number = 2): Promise<IArchiveJobResult> {
    const startTime = Date.now();

    const cutoffDate = await this.activityDaysRepo.getCutoffDate(daysToKeep);

    if (!cutoffDate) {
      return {
        success: true,
        cutoff_date: '',
        days_attempted: 0,
        days_succeeded: 0,
        days: [],
        execution_time_ms: Date.now() - startTime,
      };
    }

    const { data: dates, error: datesError } = await supabase.rpc('get_dates_to_archive', {
      p_cutoff_date: cutoffDate,
    });

    if (datesError) {
      throw new Error(`Failed to get dates to archive: ${datesError.message}`);
    }

    const datesToArchive: string[] = dates || [];
    const results: IArchiveDayResult[] = [];

    for (const date of datesToArchive) {
      try {
        let totalBets = 0;
        let totalTickets = 0;

        // Loop until both bets and tickets for this date are fully archived.
        // Each call processes one batch (p_batch_size rows) to stay within
        // PostgREST's statement timeout (~8 s).
        // Guard: count rows directly after each batch; if count doesn't
        // decrease the DB made no progress (e.g. FK blocking deletes) — bail.
        let previousRemaining = Infinity;

        while (true) {
          const { data, error } = await supabase.rpc('archive_data_by_date', {
            p_date: date,
            p_batch_size: 500,
          });

          if (error) throw new Error(error.message);

          totalBets += data.bets_archived as number;
          totalTickets += data.tickets_archived as number;

          const [{ count: betsCount }, { count: ticketsCount }] = await Promise.all([
            supabase.from('bets').select('*', { count: 'exact', head: true }).eq('date', date),
            supabase.from('tickets').select('*', { count: 'exact', head: true }).eq('date', date),
          ]);

          const remaining = (betsCount ?? 0) + (ticketsCount ?? 0);

          if (remaining === 0) break;

          if (remaining >= previousRemaining) {
            throw new Error(
              `Archive stalled on ${date}: ${remaining} rows remaining but no progress made`
            );
          }

          previousRemaining = remaining;
        }

        const dayResult: IArchiveDayResult = {
          date,
          bets_archived: totalBets,
          tickets_archived: totalTickets,
          success: true,
        };

        results.push(dayResult);
        console.log(
          `[ArchiveService] ✓ ${date}: ${dayResult.bets_archived} bets, ${dayResult.tickets_archived} tickets`
        );
      } catch (err) {
        const errorMsg = err instanceof Error ? err.message : String(err);
        console.error(`[ArchiveService] ✗ ${date}: ${errorMsg}`);

        results.push({ date, bets_archived: 0, tickets_archived: 0, success: false });

        return {
          success: false,
          cutoff_date: cutoffDate,
          days_attempted: results.length,
          days_succeeded: results.filter((r) => r.success).length,
          failed_at: date,
          error: errorMsg,
          days: results,
          execution_time_ms: Date.now() - startTime,
        };
      }
    }

    return {
      success: true,
      cutoff_date: cutoffDate,
      days_attempted: results.length,
      days_succeeded: results.length,
      days: results,
      execution_time_ms: Date.now() - startTime,
    };
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

  private async getArchiveStatsManual(): Promise<IArchiveStats> {
    const { count: betsMainCount } = await supabase
      .from('bets')
      .select('*', { count: 'exact', head: true });

    const { count: ticketsMainCount } = await supabase
      .from('tickets')
      .select('*', { count: 'exact', head: true });

    const { count: betsArchiveCount } = await supabase
      .from('bets_archive')
      .select('*', { count: 'exact', head: true });

    const { count: ticketsArchiveCount } = await supabase
      .from('tickets_archive')
      .select('*', { count: 'exact', head: true });

    const activeDays = await this.activityDaysRepo.getActiveDaysOnly();
    const lastActiveDay = activeDays.length > 0 ? activeDays[0].date : null;

    const betsTotal = (betsMainCount || 0) + (betsArchiveCount || 0);
    const ticketsTotal = (ticketsMainCount || 0) + (ticketsArchiveCount || 0);

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
        bets: betsTotal > 0 ? Math.round(((betsArchiveCount || 0) / betsTotal) * 10000) / 100 : 0,
        tickets:
          ticketsTotal > 0
            ? Math.round(((ticketsArchiveCount || 0) / ticketsTotal) * 10000) / 100
            : 0,
      },
    };
  }
}
