import { INewLotteryEntity } from '@helper/request/lottery.request';
import { ILotteryEntityBack } from '@helper/types/lottery.type';
import { randomUUID } from 'node:crypto';
import dayjs from 'dayjs';

export const lotteryBase = (
  lottery: INewLotteryEntity,
  organization_id: string
): ILotteryEntityBack => {
  const timestamp = dayjs().toISOString();
  return {
    lottery_id: randomUUID(),
    organization_id,
    name: lottery.name,
    order: lottery.order ?? 0,
    deleted_at: null,
    active: false,
    created_at: timestamp,
    edited_at: timestamp,
  };
};
