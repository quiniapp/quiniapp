import { INewLotteryEntity } from '@helper/request/lottery.response';
import { ILotteryEntityBack } from '@helper/types/lottery.type';
import { v4 as uuidv4 } from 'uuid';
import dayjs from 'dayjs';

export const lotteryBase = (lottery: INewLotteryEntity): ILotteryEntityBack => {
  const timestamp = dayjs().toISOString();
  return {
    lottery_id: uuidv4(),
    name: lottery.name,
    deleted_at: null,
    active: false,
    created_at: timestamp,
    edited_at: timestamp,
  };
};
