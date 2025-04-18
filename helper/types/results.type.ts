export interface ILotteryResultsEntityBack {
  results_id: string;
  date: string;
  results: number[];
  lottery_id: string;
  schedule_id: string;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
}

export type IBetEntityFront = Omit<
  ILotteryResultsEntityBack,
  'created_at' | 'updated_at' | 'deleted_at'
>;
