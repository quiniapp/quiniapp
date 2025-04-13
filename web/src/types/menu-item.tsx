import type { ReactNode } from 'react';
import { ROUTES } from '@/types/routes.type.ts';

export type MENU_ITEM = {
  id: string;
  name: string;
  route: ROUTES;
  icon: ReactNode;
  children?: MENU_ITEM[];
};
