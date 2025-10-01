import { USER_TYPE } from '@helper/types/user.type';
import {
  IGetAllCurrentAccountEntity,
  IGetCurrentAccountEntity,
  IUpdateCurrentAccountEntity,
} from '@helper/request/current_account.response';
import { CurrentAccountRepository } from '../repository/current-account.repository';

import { parseCurrentAccount } from '../helper/parseCurrentAccount';
import {
  ICurrentAccountEntityBack,
  ICurrentAccountEntityFront,
} from '@helper/types/current_account.type';
import { ERROR_MESSAGE } from '@helper/types/errors.type';

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

  calculateCurrentAccountHandler = async (date?: string, leave?: boolean, liquidated?: boolean) => {
    try {
      const results = await this.repository.calculateCurrentAccountHandler(date, leave, liquidated);

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

    console.log('controller', props?.date);
    try {
      if (props.user_type === USER_TYPE.CASHIER) {
        currentaccounts = await this.repository.getAllCurrentAccountHandler({
          user_id: props.user_id,
          date: props.date,
        });
      } else {
        currentaccounts = await this.repository.getAllCurrentAccountHandler({ date: props.date });
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
    props: IUpdateCurrentAccountEntity
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
      return await this.repository.updateCurrentAccountByUserHandler(current_account_id, payload);
    } catch (error) {
      console.error('updateCurrentAccountByUserHandler error:', error);
      throw error instanceof Error ? error : new Error('Unknown error');
    }
  };
}
