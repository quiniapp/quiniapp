import { ReactNode, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { IPollaSessionUser, POLLA_THEME } from '@helper/polla/types/user.type';
import {
  POLLA_VALIDATE_INTERVAL_MS,
  POLLA_REFRESH_INTERVAL_MS,
} from '@helper/polla/config/session.config';
import { apiClient } from '@/lib/apiClient';
import { AUTH_EXPIRED_EVENT } from '@/lib/authEvents';
import { applyTheme } from '@/lib/theme';
import { BACKEND_ROUTES } from '@/routes/backend-routes';
import { AuthContext } from './AuthContext';

const AUTH_HINT_KEY = 'polla_auth_hint';
const ACTIVE_ORG_KEY = 'polla_active_org';

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const queryClient = useQueryClient();

  const [user, setUser] = useState<IPollaSessionUser | null>(null);
  // Con el hint se pinta el esqueleto de la app en vez del login mientras
  // /auth/validate está en vuelo.
  const [loading, setLoading] = useState(true);
  const [activeOrganizationId, setActiveOrganizationIdState] = useState<string | null>(() =>
    sessionStorage.getItem(ACTIVE_ORG_KEY)
  );

  const validatingRef = useRef(false);

  const clearSession = useCallback(() => {
    setUser(null);
    sessionStorage.removeItem(AUTH_HINT_KEY);
    sessionStorage.removeItem(ACTIVE_ORG_KEY);
    setActiveOrganizationIdState(null);
    queryClient.clear();
  }, [queryClient]);

  const validate = useCallback(async () => {
    if (validatingRef.current) return;
    validatingRef.current = true;
    try {
      const validated = await apiClient.get<IPollaSessionUser>(BACKEND_ROUTES.auth.validate);
      setUser(validated);
      sessionStorage.setItem(AUTH_HINT_KEY, '1');
    } catch {
      clearSession();
    } finally {
      validatingRef.current = false;
      setLoading(false);
    }
  }, [clearSession]);

  useEffect(() => {
    void validate();
  }, [validate]);

  // Revalidación periódica + refresh preventivo del access token.
  useEffect(() => {
    if (!user) return undefined;

    const validateTimer = window.setInterval(() => void validate(), POLLA_VALIDATE_INTERVAL_MS);
    const refreshTimer = window.setInterval(() => {
      void apiClient.safeRefresh().catch(() => clearSession());
    }, POLLA_REFRESH_INTERVAL_MS);

    return () => {
      window.clearInterval(validateTimer);
      window.clearInterval(refreshTimer);
    };
  }, [user, validate, clearSession]);

  // El tema viaja en el usuario: se aplica al validar, loguear o cambiarlo.
  useEffect(() => {
    if (user?.theme) applyTheme(user.theme);
  }, [user?.theme]);

  // El apiClient avisa por evento cuando el refresh falló definitivamente.
  useEffect(() => {
    const handler = () => clearSession();
    window.addEventListener(AUTH_EXPIRED_EVENT, handler);
    return () => window.removeEventListener(AUTH_EXPIRED_EVENT, handler);
  }, [clearSession]);

  const login = useCallback(async (username: string, password: string) => {
    const logged = await apiClient.post<IPollaSessionUser>(BACKEND_ROUTES.auth.login, {
      username,
      password,
    });
    setUser(logged);
    sessionStorage.setItem(AUTH_HINT_KEY, '1');
    setLoading(false);
  }, []);

  const logout = useCallback(async () => {
    try {
      await apiClient.post(BACKEND_ROUTES.auth.logout, {});
    } finally {
      clearSession();
    }
  }, [clearSession]);

  const setTheme = useCallback(async (theme: POLLA_THEME) => {
    const updated = await apiClient.put<IPollaSessionUser>(BACKEND_ROUTES.auth.preferences, {
      theme,
    });
    setUser(updated);
  }, []);

  const setActiveOrganizationId = useCallback(
    (id: string | null) => {
      setActiveOrganizationIdState(id);
      if (id) sessionStorage.setItem(ACTIVE_ORG_KEY, id);
      else sessionStorage.removeItem(ACTIVE_ORG_KEY);
      queryClient.clear();
    },
    [queryClient]
  );

  const value = useMemo(
    () => ({
      user,
      role: user?.user_type ?? null,
      organizationId: activeOrganizationId ?? user?.polla_organization_id ?? null,
      isAuth: Boolean(user),
      loading,
      activeOrganizationId,
      setActiveOrganizationId,
      login,
      logout,
      refreshUser: validate,
      setTheme,
    }),
    [
      user,
      loading,
      activeOrganizationId,
      setActiveOrganizationId,
      login,
      logout,
      validate,
      setTheme,
    ]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};
