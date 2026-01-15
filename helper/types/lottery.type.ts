export interface ILotteryEntityBack {
  lottery_id: string;
  organization_id: string;
  name: string;
  active: boolean;
  order: number;
  created_at: string;
  edited_at: string;
  deleted_at: string | null;
}

export type ILotteryEntityFront = Omit<
  ILotteryEntityBack,
  'created_at' | 'edited_at' | 'deleted_at' | 'organization_id'
>;
