/* eslint-disable no-unused-vars */
export enum POLLA_EDITION_STATUS {
  ACTIVE = 'ACTIVE',
  FINISHED = 'FINISHED',
}

export enum POLLA_CREDIT_MOVEMENT_TYPE {
  LOAD = 'LOAD',
  WITHDRAW = 'WITHDRAW',
  BET = 'BET',
  BET_REFUND = 'BET_REFUND',
  ADJUSTMENT = 'ADJUSTMENT',
}
/* eslint-enable no-unused-vars */

export const POLLA_NUMBERS_REQUIRED = 10;

// ---------------------------------------------------------------- ediciones

export interface IPollaEditionEntityBack {
  polla_edition_id: string;
  polla_organization_id: string;
  polla_lottery_id: string;
  polla_schedule_id: string;
  name: string | null;
  start_date: string;
  end_date: string;
  load_limit_date: string;
  pool_amount: number;
  ticket_price: number;
  status: POLLA_EDITION_STATUS;
  winner_date: string | null;
  bets_count: number;
  collected_amount: number;
  created_at: string;
  edited_at: string;
  deleted_at: string | null;
}

export type IPollaEditionEntityFront = Omit<IPollaEditionEntityBack, 'deleted_at'>;

// --------------------------------------------------------------- resultados

export interface IPollaResultEntityBack {
  polla_result_id: string;
  polla_organization_id: string;
  polla_lottery_id: string;
  polla_schedule_id: string;
  date: string;
  results: string[];
  loaded_by: string | null;
  created_at: string;
  edited_at: string;
  deleted_at: string | null;
}

export type IPollaResultEntityFront = Omit<IPollaResultEntityBack, 'deleted_at'>;

// ----------------------------------------------------------------- jugadas

export interface IPollaBetEntityBack {
  polla_bet_id: string;
  ticket_number: string;
  polla_edition_id: string;
  polla_user_id: string;
  cashier_polla_user_id: string;
  polla_organization_id: string;
  polla_group_id: string | null;
  user_name: string;
  cashier_name: string;
  cashier_number: number | null;
  load_date: string;
  amount: number;
  numbers: string[];
  hit_numbers: string[];
  hits: number;
  winner: boolean;
  prize: number;
  hit_date: string | null;
  created_at: string;
  deleted_at: string | null;
  deleted_by: string | null;
}

export type IPollaBetEntityFront = Omit<IPollaBetEntityBack, 'deleted_at' | 'deleted_by'>;

/**
 * Proyección que recibe un jugador de las jugadas que no son suyas: sin nombres,
 * sin pasador, sin organización. El backend recorta las columnas; el front nunca
 * "esconde" datos que ya viajaron.
 */
export interface IPollaBetAnonymous {
  polla_bet_id: string;
  ticket_number: string;
  polla_edition_id: string;
  numbers: string[];
  hit_numbers: string[];
  hits: number;
  winner: boolean;
  hit_date: string | null;
  /** Solo viene con nombre si la jugada es del propio jugador o si ya ganó. */
  user_name?: string;
  is_mine?: boolean;
}

export type IPollaBetListItem = IPollaBetEntityFront | IPollaBetAnonymous;

export const isAnonymousPollaBet = (bet: IPollaBetListItem): bet is IPollaBetAnonymous =>
  !('cashier_polla_user_id' in bet);

// ---------------------------------------------------------------- créditos

export interface IPollaCreditMovementEntityBack {
  polla_credit_movement_id: string;
  polla_user_id: string;
  cashier_polla_user_id: string;
  polla_organization_id: string;
  created_by_polla_user_id: string | null;
  type: POLLA_CREDIT_MOVEMENT_TYPE;
  amount: number;
  balance_after: number;
  polla_bet_id: string | null;
  reason: string | null;
  created_at: string;
}

export type IPollaCreditMovementEntityFront = IPollaCreditMovementEntityBack;

// --------------------------------------------------------- cuenta corriente

export interface IPollaCurrentAccountEntityBack {
  polla_current_account_id: string;
  polla_user_id: string;
  user_name: string;
  user_number: number | null;
  polla_organization_id: string;
  polla_group_id: string | null;
  date: string;
  pass: number;
  successes: number;
  cashier_commission: number;
  claims: number;
  subtotal: number;
  revenue: number;
  previous_balance: number;
  previous_drag: number;
  collections: number;
  paid: number;
  bills: number;
  total: number;
  drag: number;
  leave: number;
  is_liquidated: boolean;
  created_at: string;
  edited_at: string;
}

export type IPollaCurrentAccountEntityFront = IPollaCurrentAccountEntityBack;
