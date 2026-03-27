import { IUpdateCurrentAccountEntity } from '@helper/request/current_account.request';
import { ICurrentAccountEntityBack } from '@helper/types/current_account.type';
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
export declare class CurrentAccountRepository {
  calculateCurrentAccountHandler(
    organization_id: string,
    date?: string,
    leave?: boolean,
    liquidated?: boolean
  ): Promise<any>;
  getAllCurrentAccountHandler({
    organization_id,
    user_id,
    date,
  }: {
    organization_id: string;
    user_id?: string;
    date?: string;
  }): Promise<any[]>;
  updateCurrentAccountHandler(
    current_account_id: string,
    organization_id: string,
    props: IUpdateCurrentAccountEntity,
    leave?: boolean
  ): Promise<any>;
  updateCurrentAccountByUserHandler(
    current_account_id: string,
    organization_id: string,
    props: IUpdateCurrentAccountEntity
  ): Promise<never>;
  getCurrentAccountByUserHandler(
    user_id: string,
    organization_id: string,
    date?: string
  ): Promise<ICurrentAccountEntityBack | undefined>;
  /**
   * Get all organization IDs in the network (parent + all descendants)
   */
  getOrganizationNetworkIds(organization_id: string): Promise<string[]>;
  /**
   * Calculate current accounts for entire network (organization + all sub-organizations)
   */
  calculateCurrentAccountNetworkHandler(
    organization_id: string,
    date?: string,
    leave?: boolean,
    liquidated?: boolean
  ): Promise<any>;
  /**
   * Get current accounts for entire network with support for filtering
   */
  getAllCurrentAccountNetworkHandler({
    organization_id,
    user_id,
    date,
  }: {
    organization_id: string;
    user_id?: string;
    date?: string;
  }): Promise<any[]>;
  /**
   * Get network summary (aggregated totals per organization)
   */
  getNetworkSummaryHandler(organization_id: string, date?: string): Promise<INetworkSummary[]>;
}
export {};
