import { useMemo } from 'react';
import { IScheduleEntityFront } from '@helper/types/schedule.type';
import { useSchedules } from './fetchs/schedule/useSchedules';

/**
 * Global hook that provides a Map for O(1) schedule lookups by schedule_id.
 * Fetches all schedules (including inactive ones for display purposes).
 *
 * @returns Map<schedule_id, schedule> for efficient schedule lookups
 *
 * @example
 * ```typescript
 * const scheduleMap = useScheduleMap();
 * const schedule = scheduleMap.get(schedule_id);
 * if (schedule) {
 *   console.log(`${schedule.name} (${schedule.time.slice(0, 5)})`);
 * }
 * ```
 */
export const useScheduleMap = () => {
  const { data: schedules } = useSchedules(true); // Fetch all schedules for mapping

  return useMemo(() => {
    if (!schedules) return new Map<string, IScheduleEntityFront>();
    return new Map(schedules.map(s => [s.schedule_id, s]));
  }, [schedules]);
};
