import { USER_TYPE } from '@helper/types/user.type.ts';
import { MENU_ITEM } from '@/types/menu-item';

const PUBLIC_MENU_IDS = ['Home', 'Results', 'CurrentAccount'];

export const filterMenuItemsByRole = (role: USER_TYPE | null, items: MENU_ITEM[]): MENU_ITEM[] => {
  if (role !== USER_TYPE.CASHIER) {
    return items; // ve todo
  }

  return items.filter((item) => PUBLIC_MENU_IDS.includes(item.id));
};
