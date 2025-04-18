export interface ICashierGroupEntityBack {
  group_id: string;
  name: string;
  created_at: string;
  updated_at: string;
}

export type IBetEntityFront = Omit<ICashierGroupEntityBack, 'created_at' | 'updated_at'>;
