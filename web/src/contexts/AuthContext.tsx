import { createContext, useContext } from 'react';
import { IUserEntityFront, USER_TYPE } from '@helper/types/user.type';

export type LoginPayload = { username?: string; password?: string };

export type AuthContextValue = {
  isAuth: boolean;
  loading: boolean;
  user: IUserEntityFront | null;
  role: USER_TYPE | null;
  login: (data: LoginPayload) => Promise<void>;
  logout: (logoutAll?: boolean) => Promise<void>;
  validate: () => Promise<void>;
  hasRole: (...roles: USER_TYPE[]) => boolean;
};

export const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export const useAuth = (): AuthContextValue => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth debe usarse dentro de <AuthProvider>');
  return ctx;
};
