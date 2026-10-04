import { createContext, useContext } from 'react';
import { IPollaSessionUser, POLLA_USER_TYPE } from '@helper/polla/types/user.type';

export interface AuthContextValue {
  user: IPollaSessionUser | null;
  role: POLLA_USER_TYPE | null;
  organizationId: string | null;
  isAuth: boolean;
  loading: boolean;
  /** Organización sobre la que trabaja el OWNER; null = la propia. */
  activeOrganizationId: string | null;
  // eslint-disable-next-line no-unused-vars
  setActiveOrganizationId: (id: string | null) => void;
  // eslint-disable-next-line no-unused-vars
  login: (username: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  refreshUser: () => Promise<void>;
}

export const AuthContext = createContext<AuthContextValue | null>(null);

export const useAuth = (): AuthContextValue => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth debe usarse dentro de AuthProvider');
  return ctx;
};
