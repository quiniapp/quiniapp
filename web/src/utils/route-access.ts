import { RoutesContent } from '@/routes/route';
import { ROUTES } from '@/types/routes.type';
import { USER_TYPE } from '../../../@helper/types/user.type.ts';

const PUBLIC_ROUTES = [ROUTES.HOME, ROUTES.RESULTS, ROUTES.CURRENT_ACCOUNT];

export const getAccessibleRoutes = (role: USER_TYPE | null) => {
  if (role === USER_TYPE.OWNER || role === USER_TYPE.SUPERADMIN) {
    return RoutesContent;
  }

  return RoutesContent.map((route) => {
    if (route.id !== 'MainLayout') return route;

    return {
      ...route,
      children: route.children?.filter((child) => PUBLIC_ROUTES.includes(child.path)),
    };
  });
};
