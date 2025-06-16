export interface ICurrentAccountEntityBack {
  current_account_id: string;
  user_id: string;
  user_name: string;
  user_number: number;
  // group_id: string;
  pass: number;
  successes: number;
  claims: number;
  subtotal: number;
  previous_balance: number;
  collections: number;
  paid: number;
  total: number;
  drag: number;
  leave: number; //deje
  date: string;
  created_at: string;
  edited_at: string;
  cashier_commission: number;
  bills: number;
  revenue: number; //deja
  previous_drag: number;
}

export type ICurrentAccountEntityFront = Omit<
  ICurrentAccountEntityBack,
  'created_at' | 'edited_at'
>;
