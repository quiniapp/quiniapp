export interface ILotteryEntityBack {
  lottery_id: string;
  name: string;
  active: boolean;
  created_at: string;
  updated_at: string;
}

export type IBetEntityFront = Omit<ILotteryEntityBack, 'created_at' | 'updated_at'>;
