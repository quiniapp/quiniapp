import { USER_TYPE } from '../types/user.type';

export const userTypeDictionary: Partial<Record<USER_TYPE, string>> = {
  [USER_TYPE.OWNER]: 'DUEÑO',
  [USER_TYPE.SUPERADMIN]: 'CAPITALISTA',
  [USER_TYPE.ADMIN]: 'ADMINISTRADOR',
  [USER_TYPE.CASHIER]: 'PASADOR',
};
