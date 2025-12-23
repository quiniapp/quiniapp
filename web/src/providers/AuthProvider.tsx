import React, { useCallback, useEffect, useRef, useState, useMemo } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { IUserEntityFront, USER_TYPE } from '@helper/types/user.type';
import { AuthContext, AuthContextValue, LoginPayload } from '@/contexts/AuthContext';
import { BACKEND_ROUTES } from '../../routes/routes';
import {
  SESSION_DURATION_MS,
  VALIDATE_INTERVAL_MS,
  VALIDATE_ON_VISIBILITY,
  VISIBILITY_MIN_GAP_MS,
  USER_ACTIVITY_EVENTS,
} from '@helper/config/session.config';
import { apiClient, ApiError } from '@/lib/apiClient';

export const AuthProvider: React.FC<React.PropsWithChildren> = ({ children }) => {
  const queryClient = useQueryClient();
  const [user, setUser] = useState<IUserEntityFront | null>(null);
  const [role, setRole] = useState<USER_TYPE | null>(null);
  const [isAuth, setIsAuth] = useState(false);
  const [loading, setLoading] = useState(true);

  const intervalRef = useRef<number | null>(null);
  const lastValidateRef = useRef<number>(0);
  const lastActivityRef = useRef<number>(Date.now());
  const inactivityTimerRef = useRef<number | null>(null);

  const setSession = useCallback((u: IUserEntityFront | null) => {
    if (u) {
      setUser(u);
      setRole(u.user_type);
      setIsAuth(true);
    } else {
      setUser(null);
      setRole(null);
      setIsAuth(false);
    }
  }, []);

  const validate = useCallback(async () => {
    const now = Date.now();
    if (now - lastValidateRef.current < 1500) return; // anti-spam local
    lastValidateRef.current = now;

    try {
      const user = await apiClient.get<IUserEntityFront>(BACKEND_ROUTES.auth.validate);
      if (!user) throw new Error('Respuesta inválida del servidor');
      setSession(user);
    } catch (err) {
      // Si es un error 401, simplemente limpiar la sesión
      if (err instanceof ApiError && err.statusCode === 401) {
        setSession(null);
      } else {
        setSession(null);
      }
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

        // seteo inmediato para actualizar UI
        setSession(user);
        // una sola validación posterior para asegurar cookies/estado del server
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

  const logout = useCallback(async () => {
    setLoading(true);
    try {
      await apiClient.post(BACKEND_ROUTES.auth.logout);
    } catch {
      // no-op - even if logout fails on server, clear local session
    } finally {
      // Clear all TanStack Query cache to prevent data leakage between users
      queryClient.clear();
      setSession(null);
      setLoading(false);
    }
  }, [setSession, queryClient]);

  const armInactivityTimer = useCallback(() => {
    if (inactivityTimerRef.current) window.clearTimeout(inactivityTimerRef.current);
    inactivityTimerRef.current = window.setTimeout(() => {
      // si sigue autenticado y se cumplió el tiempo, cerrar sesión
      if (isAuth) void logout();
    }, SESSION_DURATION_MS) as unknown as number;
  }, [isAuth, logout]);

  const hasRole = useCallback((...roles: USER_TYPE[]) => !!role && roles.includes(role), [role]);

  // Primer validate al montar
  useEffect(() => {
    void validate();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Revalidate periódico
  useEffect(() => {
    if (intervalRef.current) window.clearInterval(intervalRef.current);
    intervalRef.current = window.setInterval(() => {
      if (isAuth) void validate();
    }, VALIDATE_INTERVAL_MS) as unknown as number;

    return () => {
      if (intervalRef.current) window.clearInterval(intervalRef.current);
    };
  }, [isAuth, validate]);

  // Revalidate al volver a la pestaña/ventana, con throttle + cierre por inactividad
  useEffect(() => {
    if (!VALIDATE_ON_VISIBILITY) return;

    const onVisibilityOrFocus = () => {
      if (!isAuth) return;

      const now = Date.now();

      // 1) Si hubo más de SESSION_DURATION_MS sin actividad, cerrar sesión
      if (now - lastActivityRef.current >= SESSION_DURATION_MS) {
        void logout();
        return;
      }

      // 2) Si la pestaña está visible, validar como máximo cada VISIBILITY_MIN_GAP_MS
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
  }, [isAuth, validate, logout]);

  useEffect(() => {
    // función que marca actividad y reinicia watchdog
    const onUserActivity = () => {
      lastActivityRef.current = Date.now();
      armInactivityTimer();
    };

    // usar eventos definidos en la configuración compartida
    const events = [...USER_ACTIVITY_EVENTS];

    events.forEach((ev) => window.addEventListener(ev, onUserActivity, { passive: true }));
    // armar timer al montar
    armInactivityTimer();

    return () => {
      events.forEach((ev) => window.removeEventListener(ev, onUserActivity));
      if (inactivityTimerRef.current) window.clearTimeout(inactivityTimerRef.current);
    };
  }, [armInactivityTimer]);

  const value: AuthContextValue = useMemo(
    () => ({
      isAuth,
      loading,
      user,
      role,
      login,
      logout,
      validate,
      hasRole,
    }),
    [isAuth, loading, user, role, login, logout, validate, hasRole]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};
