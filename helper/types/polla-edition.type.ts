/* eslint-disable no-unused-vars */
export enum POLLA_EDITION_STATUS {
  ACTIVE = 'ACTIVE',
  FINISHED = 'FINISHED',
}
/* eslint-enable no-unused-vars */

export interface IPollaEditionEntityBack {
  polla_edition_id: string;
  organization_id: string;
  lottery_id: string;
  schedule_id: string;
  start_date: string;
  end_date: string;
  load_limit_date: string;
  pool_amount: number;
  ticket_price: number;
  status: POLLA_EDITION_STATUS;
  winner_date: string | null;
  created_at: string;
  edited_at: string;
  deleted_at: string | null;
}

export type IPollaEditionEntityFront = Omit<
  IPollaEditionEntityBack,
  'organization_id' | 'created_at' | 'edited_at' | 'deleted_at'
>;
