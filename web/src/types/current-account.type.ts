export interface Totals {
  pass: number;
  successes: number;
  claims: number;
  subtotal: number;
  previous_balance: number;
  collections: number;
  paid: number;
  total: number;
  drag: number;
  leave: number;
}

export interface ICurrentAccountEntityFront {
  claims: number;
  collections: number;
  current_account_id: string;
  date: string;
  drag: number; // Arrastre
  leave: number; // Debe
  paid: number; // Pagos
  pass: number; // Pase
  previous_balance: number; // Saldo Anterior
  subtotal: number; // Subtotal
  successes: number; // Aciertos
  total: number; // Total
  user_id: string;
  user_name: string; // Nombre
  user_number: number; // Numero
}

export interface FilterParams {
  date?: string;
  group?: string;
  employeeNumber?: string;
}

export interface CurrentAccountTableProps {
  data: ICurrentAccountEntityFront[];
  totals: {
    pass: number;
    successes: number;
    claims: number;
    subtotal: number;
    previous_balance: number;
    collections: number;
    paid: number;
    total: number;
    drag: number;
    leave: number;
  };
  isLoading: boolean;
  isPending: boolean;
}
