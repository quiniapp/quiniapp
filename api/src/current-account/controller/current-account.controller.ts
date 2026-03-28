import { USER_TYPE } from '@helper/types/user.type';
import {
  IGetAllCurrentAccountEntity,
  IGetCurrentAccountEntity,
  IUpdateCurrentAccountEntity,
} from '@helper/request/current_account.request';
import { CurrentAccountRepository } from '../repository/current-account.repository';
import { UserRepository } from '../../user/repository/user.repository';

import { parseCurrentAccount } from '../helper/parseCurrentAccount';
import {
  ICurrentAccountEntityBack,
  ICurrentAccountEntityFront,
} from '@helper/types/current_account.type';
import { ERROR_MESSAGE } from '@helper/types/errors.type';

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

type AllowedManualKeys =
  | 'claims'
  | 'paid'
  | 'collections'
  | 'bills'
  | 'previous_balance'
  | 'previous_drag';

type UpdatePayload = Partial<Pick<IUpdateCurrentAccountEntity, AllowedManualKeys>>;
export class CurrentAccountController {
  private repository = new CurrentAccountRepository();

  calculateCurrentAccountHandler = async (
    organization_id: string,
    date?: string,
    leave?: boolean,
    liquidated?: boolean
  ) => {
    try {
      const results = await this.repository.calculateCurrentAccountHandler(
        organization_id,
        date,
        leave,
        liquidated
      );

      return results.map((res: ICurrentAccountEntityBack) => parseCurrentAccount(res));
    } catch (error) {
      console.error('Creation error:', error);
      throw error instanceof Error ? error : new Error('Unknown error');
    }
  };

  getAllCurrentAccountHandler = async (
    props: IGetAllCurrentAccountEntity
  ): Promise<ICurrentAccountEntityFront[]> => {
    let currentaccounts;

    try {
      if (props.user_type === USER_TYPE.CASHIER) {
        currentaccounts = await this.repository.getAllCurrentAccountHandler({
          organization_id: props.organization_id,
          user_id: props.user_id,
          date: props.date,
        });
      } else {
        currentaccounts = await this.repository.getAllCurrentAccountHandler({
          organization_id: props.organization_id,
          date: props.date,
        });
      }

      return currentaccounts.map((currentaccount) => {
        return parseCurrentAccount(currentaccount);
      });
    } catch (error) {
      console.error('getAllCurrentAccountHandler error:', error);
      throw error instanceof Error ? error : new Error('Unknown error');
    }
  };
  updateCurrentAccountHandler = async (
    current_account_id: string,
    props: IUpdateCurrentAccountEntity,
    organization_id: string,
    leave?: boolean
  ): Promise<ICurrentAccountEntityFront> => {
    try {
      // Construye payload solo con las keys permitidas y definidas

      const payload: UpdatePayload = {};
      if (props.claims !== undefined) payload.claims = Number(props.claims);
      if (props.paid !== undefined) payload.paid = Number(props.paid);
      if (props.collections !== undefined) payload.collections = Number(props.collections);
      if (props.bills !== undefined) payload.bills = Number(props.bills);
      if (props.previous_drag !== undefined) payload.previous_drag = Number(props.previous_drag);
      if (props.previous_balance !== undefined)
        payload.previous_balance = Number(props.previous_balance);
      // Llama a tu repo (que a su vez llama al RPC update_current_account_recompute)

      const currentAccount = await this.repository.updateCurrentAccountHandler(
        current_account_id,
        organization_id,
        payload,
        leave
      );

      return parseCurrentAccount(currentAccount);
    } catch (error) {
      console.error('updateCurrentAccountHandler error:', error);
      throw error instanceof Error ? error : new Error('Unknown error');
    }
  };

  getCurrentAccountHandler = async (
    props: IGetCurrentAccountEntity
  ): Promise<ICurrentAccountEntityFront> => {
    try {
      const currentaccounts = await this.repository.getCurrentAccountByUserHandler(
        props.user_id,
        props.organization_id,
        props.date
      );

      if (!currentaccounts) {
        throw new Error(ERROR_MESSAGE.NOT_FOUND);
      }

      return parseCurrentAccount(currentaccounts);
    } catch (error) {
      console.error('getCurrentAccountHandler error:', error);
      throw error instanceof Error ? error : new Error('Unknown error');
    }
  };

  updateCurrentAccountByUserHandler = async (
    current_account_id: string,
    props: IUpdateCurrentAccountEntity,
    organization_id: string
  ): Promise<ICurrentAccountEntityFront> => {
    try {
      const payload: UpdatePayload = {};

      if (props.claims !== undefined) payload.claims = Number(props.claims);
      if (props.paid !== undefined) payload.paid = Number(props.paid);
      if (props.collections !== undefined) payload.collections = Number(props.collections);
      if (props.bills !== undefined) payload.bills = Number(props.bills);
      if (props.previous_drag !== undefined) payload.previous_drag = Number(props.previous_drag);
      if (props.previous_balance !== undefined)
        payload.previous_balance = Number(props.previous_balance);

      // IMPORTANTE: devolvemos la fila actualizada
      return await this.repository.updateCurrentAccountByUserHandler(
        current_account_id,
        organization_id,
        payload
      );
    } catch (error) {
      console.error('updateCurrentAccountByUserHandler error:', error);
      throw error instanceof Error ? error : new Error('Unknown error');
    }
  };

  // Network-aware methods for CAPITALIST users

  /**
   * Calculate current accounts for entire network (org + sub-orgs)
   */
  calculateCurrentAccountNetworkHandler = async (
    organization_id: string,
    date?: string,
    leave?: boolean,
    liquidated?: boolean
  ) => {
    try {
      const results = await this.repository.calculateCurrentAccountNetworkHandler(
        organization_id,
        date,
        leave,
        liquidated
      );

      return results.map((res: ICurrentAccountEntityBack) => parseCurrentAccount(res));
    } catch (error) {
      console.error('calculateCurrentAccountNetworkHandler error:', error);
      throw error instanceof Error ? error : new Error('Unknown error');
    }
  };

  /**
   * Get all current accounts for network (org + sub-orgs)
   */
  getAllCurrentAccountNetworkHandler = async (
    props: IGetAllCurrentAccountEntity & { include_network?: boolean; group_user_ids?: string[] }
  ): Promise<ICurrentAccountEntityFront[]> => {
    try {
      let currentaccounts;

      if (props.user_type === USER_TYPE.CASHIER) {
        // CASHIER solo ve su propia cuenta
        currentaccounts = await this.repository.getAllCurrentAccountHandler({
          organization_id: props.organization_id,
          user_id: props.user_id,
          date: props.date,
        });
      } else if ([USER_TYPE.CAPITALIST, USER_TYPE.OWNER].includes(props.user_type)) {
        // CAPITALIST/OWNER siempre ven toda la red
        currentaccounts = await this.repository.getAllCurrentAccountNetworkHandler({
          organization_id: props.organization_id,
          date: props.date,
        });
      } else {
        // SUPERADMIN/ADMIN: si están en org raíz, ven toda la red; si están en sub-org, solo su org
        const userRepo = new UserRepository();
        const isSubOrg = await userRepo.isSubOrganization(props.organization_id);
        if (isSubOrg) {
          currentaccounts = await this.repository.getAllCurrentAccountHandler({
            organization_id: props.organization_id,
            date: props.date,
          });
        } else {
          currentaccounts = await this.repository.getAllCurrentAccountNetworkHandler({
            organization_id: props.organization_id,
            date: props.date,
          });
        }
      }

      let results = currentaccounts.map((currentaccount) => parseCurrentAccount(currentaccount));

      if (props.group_user_ids?.length) {
        results = results.filter((a) => props.group_user_ids!.includes(a.user_id));
      }

      return results;
    } catch (error) {
      console.error('getAllCurrentAccountNetworkHandler error:', error);
      throw error instanceof Error ? error : new Error('Unknown error');
    }
  };

  /**
   * Get network summary (aggregated totals per organization)
   */
  getNetworkSummaryHandler = async (
    organization_id: string,
    date?: string
  ): Promise<INetworkSummary[]> => {
    try {
      return await this.repository.getNetworkSummaryHandler(organization_id, date);
    } catch (error) {
      console.error('getNetworkSummaryHandler error:', error);
      throw error instanceof Error ? error : new Error('Unknown error');
    }
  };
}
