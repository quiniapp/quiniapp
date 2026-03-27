import { v4 as uuidv4 } from 'uuid';
import dayjs from 'dayjs';
export const lotteryBase = (lottery, organization_id) => {
    const timestamp = dayjs().toISOString();
    return {
        lottery_id: uuidv4(),
        organization_id,
        name: lottery.name,
        order: lottery.order ?? 0,
        deleted_at: null,
        active: false,
        created_at: timestamp,
        edited_at: timestamp,
    };
};
