import {
  ICurrentAccountEntityBack,
  ICurrentAccountEntityFront,
} from '@helper/types/current_account.type';

export const parseCurrentAccount = (
  currentAccount: ICurrentAccountEntityBack
): ICurrentAccountEntityFront => {
  return {
    current_account_id: currentAccount.current_account_id,
    user_id: currentAccount.user_id,
    user_name: currentAccount.user_name,
    user_number: currentAccount.user_number,
    pass: currentAccount.pass,
    successes: currentAccount.successes,
    claims: currentAccount.claims,
    subtotal: currentAccount.subtotal,
    previous_balance: currentAccount.previous_balance,
    collections: currentAccount.collections,
    paid: currentAccount.paid,
    total: currentAccount.total,
    drag: currentAccount.drag,
    leave: currentAccount.leave,
    date: currentAccount.date,
  };
};
