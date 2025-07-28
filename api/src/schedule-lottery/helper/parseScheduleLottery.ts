import {
  IScheduleLotteryEntityBack,
  IScheduleLotteryEntityFront,
  SCHEDULE_DAY,
} from '@helper/types/schedule-lottery.type';

export const parseScheduleLottery = (
  props: IScheduleLotteryEntityBack[]
): IScheduleLotteryEntityFront => {
  const result: IScheduleLotteryEntityFront = {};

  for (const row of props) {
    // Convertir day numérico a string clave del enum
    const dayKey = Object.keys(SCHEDULE_DAY).find(
      (key) => SCHEDULE_DAY[key as keyof typeof SCHEDULE_DAY] === row.day
    ) as keyof typeof SCHEDULE_DAY;
    if (!dayKey) continue;

    if (!result[dayKey]) result[dayKey] = {};
    if (!result[dayKey]![row.schedule_id]) result[dayKey]![row.schedule_id] = [];

    result[dayKey]![row.schedule_id].push(row.lottery_id);
  }

  return result;
};
