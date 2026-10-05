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

/** `bets_count` y `collected_amount` son totales: la API solo se los manda a un admin. */
export type IPollaEditionEntityFront = Omit<
  IPollaEditionEntityBack,
  'deleted_at' | 'bets_count' | 'collected_amount'
> &
  Partial<Pick<IPollaEditionEntityBack, 'bets_count' | 'collected_amount'>>;

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

/** Resultado de procesar los aciertos de un día en una edición. */
export interface IPollaProcessedEdition {
  polla_edition_id?: string;
  skipped?: boolean;
  bets_updated?: number;
  winners?: number;
  winner_date?: string | null;
  previous_winner_date?: string | null;
  /** Un reproceso revirtió al ganador: hay que procesar los días siguientes. */
  reopened?: boolean;
}

export interface IPollaProcessResult {
  date: string;
  editions: IPollaProcessedEdition[];
  accounts_updated: number;
}

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
  /** 10 números de 2 cifras; se pueden repetir. */
  numbers: string[];
  /**
   * En paralelo a `numbers`: día en que acertó cada casillero (`YYYY-MM-DD`) o
   * `null` si todavía no acertó. Un número jugado 5 veces necesita salir 5 veces.
   */
  hit_dates: (string | null)[];
  /** Derivado de `hit_dates`: los números de los casilleros acertados. */
  hit_numbers: string[];
  hits: number;
  winner: boolean;
  prize: number;
  hit_date: string | null;
  created_at: string;
  deleted_at: string | null;
  deleted_by: string | null;
}

/** Campos que la API agrega a cada jugada que lista. */
export interface IPollaBetDerivedFields {
  /** Grupo del pasador (la columna "Coord"). */
  group_name: string | null;
  /** Jugador dueño de la jugada; `null` si la jugó el propio pasador. */
  client_name: string | null;
}

export type IPollaBetEntityFront = Omit<IPollaBetEntityBack, 'deleted_at' | 'deleted_by'> &
  IPollaBetDerivedFields;

/**
 * Lo que recibe un pasador o un jugador de cada jugada: números, aciertos y
 * quién la jugó, sin ids internos ni montos. Los totales son solo de admin.
 */
export interface IPollaBetPublic extends IPollaBetDerivedFields {
  polla_bet_id: string;
  ticket_number: string;
  polla_edition_id: string;
  cashier_name: string;
  cashier_number: number | null;
  load_date: string;
  numbers: string[];
  hit_dates: (string | null)[];
  hit_numbers: string[];
  hits: number;
  winner: boolean;
  hit_date: string | null;
  /** Solo distinto de 0 si la jugada ganó: el premio es público. */
  prize: number;
  /** Es del usuario o, para un pasador, está imputada a él (sus jugadores). */
  is_mine: boolean;
  /** El usuario es el dueño: puede editarla o borrarla dentro del plazo. */
  can_edit: boolean;
}

export type IPollaBetListItem = IPollaBetEntityFront | IPollaBetPublic;

export const isPublicPollaBet = (bet: IPollaBetListItem): bet is IPollaBetPublic =>
  !('cashier_polla_user_id' in bet);

/** Lo mínimo para repetir un ticket: sus 10 números. */
export interface IPollaBetToRepeat {
  ticket_number: string;
  polla_edition_id: string;
  numbers: string[];
}

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
