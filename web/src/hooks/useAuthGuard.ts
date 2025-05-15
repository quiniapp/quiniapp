import { useSessionStore } from '../stores/sessionStore';
import { USER_TYPE } from '../../../helper/types/user.type.ts';


export const useAuthGuard = (allowedRoles: USER_TYPE[]) => {
  const { isAuth, role } = useSessionStore();

  const canAccess = isAuth && role && allowedRoles.includes(role);

  return canAccess;
};
