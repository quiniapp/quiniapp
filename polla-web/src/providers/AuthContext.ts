import { createContext, useContext } from 'react';
import { IPollaSessionUser, POLLA_THEME, POLLA_USER_TYPE } from '@helper/polla/types/user.type';

export interface AuthContextValue {
  user: IPollaSessionUser | null;
  role: POLLA_USER_TYPE | null;
  organizationId: string | null;
  isAuth: boolean;
  loading: boolean;
  /** Organización sobre la que trabaja el OWNER; null = la propia. */
  activeOrganizationId: string | null;
  setActiveOrganizationId: (id: string | null) => void;
  login: (username: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  refreshUser: () => Promise<void>;
  /** Guarda el tema en la DB y lo aplica. */
  setTheme: (theme: POLLA_THEME) => Promise<void>;
}

export const AuthContext = createContext<AuthContextValue | null>(null);

export const useAuth = (): AuthContextValue => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth debe usarse dentro de AuthProvider');
  return ctx;
};
