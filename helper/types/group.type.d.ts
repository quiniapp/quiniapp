export interface ICashierGroupEntityBack {
  group_id: string;
  name: string;
  created_at: string;
  edited_at: string;
}
export type IBetEntityFront = Omit<ICashierGroupEntityBack, 'created_at' | 'updedited_atated_at'>;
