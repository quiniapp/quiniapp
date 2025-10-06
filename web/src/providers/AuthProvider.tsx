import React, { useCallback, useEffect, useRef, useState } from 'react';
import { IUserEntityFront, USER_TYPE } from '../../../@helper/types/user.type';
import { AuthContext, AuthContextValue, LoginPayload } from '@/contexts/AuthContext';
import { BACKEND_ROUTES } from '../../routes/routes';


const VALIDATE_INTERVAL_MS = 4 * 60 * 1000;
const VALIDATE_ON_VISIBILITY = true;

export const AuthProvider: React.FC<React.PropsWithChildren> = ({ children }) => {
  const [user, setUser] = useState<IUserEntityFront | null>(null);
  const [role, setRole] = useState<USER_TYPE | null>(null);
  const [isAuth, setIsAuth] = useState(false);
  const [loading, setLoading] = useState(true);

  const intervalRef = useRef<number | null>(null);
  const lastValidateRef = useRef<number>(0);

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
    if (now - lastValidateRef.current < 1500) return; // anti-spam
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
      setSession(null);
      setLoading(false);
    }
  }, [setSession]);

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

  // Revalidate al volver a la pestaña/ventana
  useEffect(() => {
    if (!VALIDATE_ON_VISIBILITY) return;
    const onVisibility = () => {
      if (document.visibilityState === 'visible' && isAuth) void validate();
    };
    document.addEventListener('visibilitychange', onVisibility);
    window.addEventListener('focus', onVisibility);
    return () => {
      document.removeEventListener('visibilitychange', onVisibility);
      window.removeEventListener('focus', onVisibility);
    };
  }, [isAuth, validate]);

  const value: AuthContextValue = {
    isAuth,
    loading,
    user,
    role,
    login,
    logout,
    validate,
    hasRole,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};
