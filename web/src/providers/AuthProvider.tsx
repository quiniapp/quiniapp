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
      const res = await fetch(BACKEND_ROUTES.auth.validate, {
        method: 'GET',
        credentials: 'include',
      });

      if (res.status === 401) {
        setSession(null);
        return;
      }

      if (!res.ok) throw new Error('No autenticado');

      const { data } = await res.json();
      if (!data?.user) throw new Error('Respuesta inválida del servidor');
      setSession(data.user);
    } catch {
      setSession(null);
    } finally {
      setLoading(false);
    }
  }, [setSession]);

  const login = useCallback(
    async (payload: LoginPayload) => {
      setLoading(true);
      try {
        const res = await fetch(BACKEND_ROUTES.auth.login, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify(payload),
        });

        if (!res.ok) {
          const err = await res.json().catch(() => ({}));
          throw new Error(err?.message || 'Login failed');
        }

        const { data } = await res.json();
        if (!data?.user) throw new Error('Respuesta inválida del servidor');

        // seteo inmediato para actualizar UI
        setSession(data.user);
        // una sola validación posterior para asegurar cookies/estado del server
        await validate();
      } finally {
        setLoading(false);
      }
    },
    [setSession, validate]
  );

  const logout = useCallback(async () => {
    setLoading(true);
    try {
      await fetch(BACKEND_ROUTES.auth.logout, { method: 'POST', credentials: 'include' });
    } catch {
      // no-op
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
