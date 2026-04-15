import { USER_TYPE } from '../types/user.type';

// User hierarchy: OWNER -> CAPITALIST -> SUPERADMIN -> ADMIN -> CASHIER
export const userTypeDictionary: Partial<Record<USER_TYPE, string>> = {
  [USER_TYPE.OWNER]: 'DUEÑO',
  [USER_TYPE.CAPITALIST]: 'CAPITALISTA',
  [USER_TYPE.SUPERADMIN]: 'SUPERADMIN',
  [USER_TYPE.ADMIN]: 'ADMINISTRADOR',
  [USER_TYPE.CASHIER]: 'PASADOR',
};
