import type { ReactNode } from 'react';

import { ROUTES } from '@/types/routes.type.ts';
import { USER_TYPE } from '@helper/types/user.type';

export type MENU_ITEM = {
  id: string;
  name: string;
  route: ROUTES;
  icon: ReactNode;
  children?: MENU_ITEM[];
  /** If set, only these roles see this item. If omitted, all roles see it. */
  roles?: USER_TYPE[];
};
