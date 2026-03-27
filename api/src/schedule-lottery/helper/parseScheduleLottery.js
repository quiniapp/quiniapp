import { SCHEDULE_DAY, } from '@helper/types/schedule-lottery.type';
export const parseScheduleLottery = (props) => {
    const result = {};
    for (const row of props) {
        const dayKey = Object.keys(SCHEDULE_DAY).find((key) => SCHEDULE_DAY[key] === row.day);
        if (!dayKey)
            continue;
        if (!result[dayKey])
            result[dayKey] = {};
        if (!result[dayKey][row.schedule_id])
            result[dayKey][row.schedule_id] = [];
        result[dayKey][row.schedule_id].push(row.lottery_id);
    }
    // Forzar el cast al tipo final al retornar
    return result;
};
