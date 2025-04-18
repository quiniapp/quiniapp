export interface IScheduleEntityBack {
  schedule_id: string;
  name: string;
  time: string;
  active: boolean;
  created_at: string;
  updated_at: string;
}

export type IBetEntityFront = Omit<IScheduleEntityBack, 'created_at' | 'updated_at'>;
