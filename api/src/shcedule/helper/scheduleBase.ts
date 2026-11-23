import { INewScheduleEntity } from '@helper/request/schedule.request';
import { IScheduleEntityBack } from '@helper/types/schedule.type';
import { randomUUID } from 'node:crypto';
import dayjs from 'dayjs';

export const scheduleBase = (
  schedule: INewScheduleEntity,
  organization_id: string
): IScheduleEntityBack => {
  const timestamp = dayjs().toISOString();
  return {
    schedule_id: randomUUID(),
    name: schedule.name,
    time: schedule.time,
    active: true,
    organization_id,
    created_at: timestamp,
    edited_at: timestamp,
  };
};
