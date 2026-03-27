import {
  IGetAllCurrentAccountEntity,
  IGetCurrentAccountEntity,
  IUpdateCurrentAccountEntity,
} from '@helper/request/current_account.request';
import { ICurrentAccountEntityFront } from '@helper/types/current_account.type';
interface INetworkSummary {
  organization_id: string;
  organization_name: string;
  total_pass: number;
  total_successes: number;
  total_claims: number;
  total_collections: number;
  total_paid: number;
  total_balance: number;
  total_leave: number;
  total_drag: number;
  cashier_count: number;
}
export declare class CurrentAccountController {
  private repository;
  calculateCurrentAccountHandler: (
    organization_id: string,
    date?: string,
    leave?: boolean,
    liquidated?: boolean
  ) => Promise<any>;
  getAllCurrentAccountHandler: (
    props: IGetAllCurrentAccountEntity
  ) => Promise<ICurrentAccountEntityFront[]>;
  updateCurrentAccountHandler: (
    current_account_id: string,
    props: IUpdateCurrentAccountEntity,
    organization_id: string,
    leave?: boolean
  ) => Promise<ICurrentAccountEntityFront>;
  getCurrentAccountHandler: (
    props: IGetCurrentAccountEntity
  ) => Promise<ICurrentAccountEntityFront>;
  updateCurrentAccountByUserHandler: (
    current_account_id: string,
    props: IUpdateCurrentAccountEntity,
    organization_id: string
  ) => Promise<ICurrentAccountEntityFront>;
  /**
   * Calculate current accounts for entire network (org + sub-orgs)
   */
  calculateCurrentAccountNetworkHandler: (
    organization_id: string,
    date?: string,
    leave?: boolean,
    liquidated?: boolean
  ) => Promise<any>;
  /**
   * Get all current accounts for network (org + sub-orgs)
   */
  getAllCurrentAccountNetworkHandler: (
    props: IGetAllCurrentAccountEntity & {
      include_network?: boolean;
    }
  ) => Promise<ICurrentAccountEntityFront[]>;
  /**
   * Get network summary (aggregated totals per organization)
   */
  getNetworkSummaryHandler: (organization_id: string, date?: string) => Promise<INetworkSummary[]>;
}
export {};
