export interface IScheduleEntityBack {
  schedule_id: string;
  name: string;
  time: string;
  created_at: string;
  edited_at: string;
}

export type IScheduleEntityFront = Omit<IScheduleEntityBack, 'created_at' | 'edited_at'>;
