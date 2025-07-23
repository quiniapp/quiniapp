import { USER_TYPE } from '../types/user.type';

export const userTypeDictionary: Partial<Record<USER_TYPE, string>> = {
  [USER_TYPE.ADMIN]: 'ADMINISTRADOR',
  [USER_TYPE.CASHIER]: 'CAJERO',
  [USER_TYPE.SUPERADMIN]: 'SUPERADMINISTRADOR',
  // no incluyas OWNER si no querés mostrarlo
};
