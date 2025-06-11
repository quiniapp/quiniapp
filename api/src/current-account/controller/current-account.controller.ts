import { USER_TYPE } from '@helper/types/user.type';
import {
  IGetAllCurrentAccountEntity,
  IUpdateCurrentAccountEntity,
} from '@helper/request/current_account.response';
import { CurrentAccountRepository } from '../repository/current-account.repository';
import { ICurrentAccountEntityFront } from '@helper/types/current_account.type';
import { parseCurrentAccount } from '../helper/parseCurrentAccount';

export class CurrentAccountController {
  private repository = new CurrentAccountRepository();

  calculateCurrentAccountHandler = async () => {
    try {
      const result = await this.repository.calculateCurrentAccountHandler();
      return parseCurrentAccount(result);
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
        currentaccounts = await this.repository.getAllCurrentAccountHandler(props.user_id);
      } else {
        currentaccounts = await this.repository.getAllCurrentAccountHandler();
      }

      return currentaccounts.map((currentaccount) => {
        return parseCurrentAccount(currentaccount);
      });
    } catch (error) {
      console.error('GetAll error:', error);
      throw error instanceof Error ? error : new Error('Unknown error');
    }
  };
  updateCurrentAccountHandler = async (
    current_account_id: string,
    props: IUpdateCurrentAccountEntity
  ): Promise<ICurrentAccountEntityFront> => {
    try {
      const currentAccount = await this.repository.updateCurrentAccountHandler(props);

      return parseCurrentAccount(currentAccount);
    } catch (error) {
      console.error('GetAll error:', error);
      throw error instanceof Error ? error : new Error('Unknown error');
    }
  };
}
