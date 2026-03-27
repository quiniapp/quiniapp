import { v4 as uuidv4 } from 'uuid';
import dayjs from 'dayjs';
export const scheduleBase = (schedule, organization_id) => {
    const timestamp = dayjs().toISOString();
    return {
        schedule_id: uuidv4(),
        name: schedule.name,
        time: schedule.time,
        active: true,
        organization_id,
        created_at: timestamp,
        edited_at: timestamp,
    };
};
