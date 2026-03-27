import dayjs from 'dayjs';
import utc from 'dayjs/plugin/utc';
import timezone from 'dayjs/plugin/timezone';
dayjs.extend(utc);
dayjs.extend(timezone);
export const betBase = (bet) => {
    return {
        ...bet,
        scheduleLottery: bet.scheduleLottery.map((schLot) => {
            const schedule = schLot.schedule;
            return {
                schedule: schedule.schedule_id,
                lotteries: schLot.lotteries.map((lot) => lot.lottery_id),
            };
        }),
    };
};
