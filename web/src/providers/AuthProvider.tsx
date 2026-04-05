import React, { useCallback, useEffect, useRef, useState, useMemo } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { IUserEntityFront, USER_TYPE } from '@helper/types/user.type';
import { AuthContext, AuthContextValue, LoginPayload } from '@/contexts/AuthContext';
import { BACKEND_ROUTES } from '../../routes/routes';
import {
  VALIDATE_INTERVAL_MS,
  VALIDATE_ON_VISIBILITY,
  VISIBILITY_MIN_GAP_MS,
} from '@helper/config/session.config';
import { apiClient, ApiError } from '@/lib/apiClient';
import { AUTH_EXPIRED_EVENT } from '@/lib/authEvents';

// Auto-refresh access token every 13-14 minutes (random to avoid thundering herd)
const AUTO_REFRESH_INTERVAL_MS = (13 + Math.random()) * 60 * 1000;

// Extended user type with organization_id from validate endpoint
interface UserWithOrg extends IUserEntityFront {
  organization_id: string;
  group_id: string;
}

export const AuthProvider: React.FC<React.PropsWithChildren> = ({ children }) => {
  const queryClient = useQueryClient();
  const [user, setUser] = useState<IUserEntityFront | null>(null);
  const [role, setRole] = useState<USER_TYPE | null>(null);
  const [organizationId, setOrganizationId] = useState<string | null>(null);
  const [groupId, setGroupId] = useState<string | null>(null);
  const [isAuth, setIsAuth] = useState(false);
  const [loading, setLoading] = useState(true);

  const validateIntervalRef = useRef<number | null>(null);
  const refreshIntervalRef = useRef<number | null>(null);
  const lastValidateRef = useRef<number>(0);

  const setSession = useCallback((u: UserWithOrg | null) => {
    if (u) {
      setUser(u);
      setRole(u.user_type);
      setOrganizationId(u.organization_id);
      setGroupId(u.group_id ?? null);
      setIsAuth(true);
    } else {
      setUser(null);
      setRole(null);
      setOrganizationId(null);
      setGroupId(null);
      setIsAuth(false);
    }
  }, []);

  const validate = useCallback(async () => {
    const now = Date.now();
    if (now - lastValidateRef.current < 1500) return; // anti-spam local
    lastValidateRef.current = now;

    try {
      const user = await apiClient.get<UserWithOrg>(BACKEND_ROUTES.auth.validate);
      if (!user) throw new Error('Respuesta inválida del servidor');
      setSession(user);
    } catch (err) {
      if (err instanceof ApiError && err.statusCode === 401) {
        setSession(null);
      }
      // Otros errores (red, 5xx): no desconectar, el intervalo siguiente reintentará
    } finally {
      setLoading(false);
    }
  }, [setSession]);

  const login = useCallback(
    async (payload: LoginPayload) => {
      setLoading(true);
      try {
        const user = await apiClient.post<IUserEntityFront>(
          BACKEND_ROUTES.auth.login,
          payload
        );
        if (!user) throw new Error('Respuesta inválida del servidor');

        // validate establece la sesión con todos los datos (incluyendo organization_id)
        await validate();
      } catch (err) {
        // Re-lanzar el error con el mensaje del servidor para que el componente lo capture
        if (err instanceof ApiError) {
          throw new Error(err.message);
        }
        throw err;
      } finally {
        setLoading(false);
      }
    },
    [setSession, validate]
  );

  const logout = useCallback(
    async (logoutAll: boolean = false) => {
      setLoading(true);
      try {
        const endpoint = logoutAll
          ? BACKEND_ROUTES.auth.logoutAll
          : BACKEND_ROUTES.auth.logout;
        await apiClient.post(endpoint, undefined, { _skipRefreshRetry: true });
      } catch {
        // no-op - even if logout fails on server, clear local session
      } finally {
        // Clear all TanStack Query cache to prevent data leakage between users
        queryClient.clear();
        setSession(null);
        setLoading(false);
      }
    },
    [setSession, queryClient]
  );

  const refreshAccessToken = useCallback(async () => {
    try {
      await apiClient.post(BACKEND_ROUTES.auth.refresh);
    } catch (error) {
      // Refresh failed - session likely expired or no refresh token (old session)
      console.warn('[Auth] Refresh token failed, logging out:', error);
      void logout();
    }
  }, [logout]);

  const hasRole = useCallback((...roles: USER_TYPE[]) => !!role && roles.includes(role), [role]);

  // Escuchar evento auth:expired disparado por apiClient cuando el refresh falla.
  // En este caso el token ya no existe — no llamamos al server logout, solo limpiamos estado local.
  useEffect(() => {
    const handleAuthExpired = () => {
      queryClient.clear();
      setSession(null);
    };
    window.addEventListener(AUTH_EXPIRED_EVENT, handleAuthExpired);
    return () => window.removeEventListener(AUTH_EXPIRED_EVENT, handleAuthExpired);
  }, [queryClient, setSession]);

  // Primer validate al montar
  useEffect(() => {
    void validate();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Validación periódica (cada 4 minutos)
  // Backend maneja expiración de sesión con sliding window
  useEffect(() => {
    if (validateIntervalRef.current) window.clearInterval(validateIntervalRef.current);

    if (isAuth) {
      validateIntervalRef.current = window.setInterval(() => {
        void validate();
      }, VALIDATE_INTERVAL_MS) as unknown as number;
    }

    return () => {
      if (validateIntervalRef.current) window.clearInterval(validateIntervalRef.current);
    };
  }, [isAuth, validate]);

  // Auto-refresh de access token (cada 13-14 minutos)
  // Access token expira a los 15 minutos, refrescamos antes
  useEffect(() => {
    if (refreshIntervalRef.current) window.clearInterval(refreshIntervalRef.current);

    if (isAuth) {
      refreshIntervalRef.current = window.setInterval(() => {
        void refreshAccessToken();
      }, AUTO_REFRESH_INTERVAL_MS) as unknown as number;
    }

    return () => {
      if (refreshIntervalRef.current) window.clearInterval(refreshIntervalRef.current);
    };
  }, [isAuth, refreshAccessToken]);

  // Revalidate al volver a la pestaña/ventana con throttle
  // Backend maneja el sliding window, solo validamos para actualizar UI
  useEffect(() => {
    if (!VALIDATE_ON_VISIBILITY) return;

    const onVisibilityOrFocus = () => {
      if (!isAuth) return;

      const now = Date.now();

      // Validar como máximo cada VISIBILITY_MIN_GAP_MS
      if (
        document.visibilityState === 'visible' &&
        now - lastValidateRef.current >= VISIBILITY_MIN_GAP_MS
      ) {
        void validate();
      }
    };

    document.addEventListener('visibilitychange', onVisibilityOrFocus);
    window.addEventListener('focus', onVisibilityOrFocus);

    return () => {
      document.removeEventListener('visibilitychange', onVisibilityOrFocus);
      window.removeEventListener('focus', onVisibilityOrFocus);
    };
  }, [isAuth, validate]);

  const value: AuthContextValue = useMemo(
    () => ({
      isAuth,
      loading,
      user,
      role,
      organizationId,
      groupId,
      login,
      logout,
      validate,
      hasRole,
    }),
    [isAuth, loading, user, role, organizationId, groupId, login, logout, validate, hasRole]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};
