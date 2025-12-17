import { INewLotteryEntity } from '@helper/request/lottery.request';
import { ILotteryEntityBack } from '@helper/types/lottery.type';
import { v4 as uuidv4 } from 'uuid';
import dayjs from 'dayjs';

export const lotteryBase = (
  lottery: INewLotteryEntity,
  organization_id: string
): ILotteryEntityBack => {
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
