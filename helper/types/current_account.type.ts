export interface ICurrentAccountEntityBack {
  current_account_id: string;
  organization_id: string;
  user_id: string;
  user_name: string;
  user_number: number;
  // group_id: string;
  pass: number; //sp
  successes: number; // sp
  claims: number; // sp
  subtotal: number; // sp
  previous_balance: number; // sp
  collections: number; // sp
  paid: number; // sp
  total: number; // sp
  drag: number; // sp
  leave: number; //deje
  date: string;
  created_at: string;
  edited_at: string;
  cashier_commission: number;
  bills: number;
  revenue: number; //deja
  previous_drag: number;
  is_liquidated: boolean;
}

export type ICurrentAccountEntityFront = Omit<
  ICurrentAccountEntityBack,
  'created_at' | 'edited_at'
>;
