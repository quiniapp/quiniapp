// src/auth/AuthProvider.tsx
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { IUserEntityFront, USER_TYPE } from '../../../helper/types/user.type';
import { AuthContext, AuthContextValue, LoginPayload } from '@/contexts/AuthContext';
import { ROUTES } from 'routes/routes';

// ===== Config cliente =====
const VALIDATE_INTERVAL_MS = 4 * 60 * 1000; // 4 minutos (ligeramente menor al throttle del server)
const VALIDATE_ON_VISIBILITY = true;

export const AuthProvider: React.FC<React.PropsWithChildren> = ({ children }) => {
  const [user, setUser] = useState<IUserEntityFront | null>(null);
  const [role, setRole] = useState<USER_TYPE | null>(null);
  const [isAuth, setIsAuth] = useState(false);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();
  const location = useLocation();
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
    // throttle mínimo por si muchas vistas llaman a la vez
    const now = Date.now();
    if (now - lastValidateRef.current < 1500) return;
    lastValidateRef.current = now;

    try {
      const res = await fetch(ROUTES.auth.validate /* o /auth/me */, {
        method: 'GET',
        credentials: 'include',
      });
      if (!res.ok) throw new Error('No autenticado');
      const { data } = await res.json();
      if (data?.user) {
        setSession(data.user);
      } else {
        setSession(null);
      }
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
        const res = await fetch(ROUTES.auth.login, {
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
        setSession(data.user);
        // Redirigí a la ruta que el usuario quiso originalmente o al home
        const from = (location.state as any)?.from?.pathname || '/';
        navigate(from, { replace: true });
      } catch (e) {
        setSession(null);
        throw e;
      } finally {
        setLoading(false);
      }
    },
    [location.state, navigate, setSession]
  );

  const logout = useCallback(async () => {
    setLoading(true);
    try {
      await fetch(ROUTES.auth.logout, {
        method: 'POST',
        credentials: 'include',
      });
    } catch {
      /* no-op, igual limpiamos estado */
    } finally {
      setSession(null);
      setLoading(false);
      navigate('/login', { replace: true });
    }
  }, [navigate, setSession]);

  const hasRole = useCallback((...roles: USER_TYPE[]) => !!role && roles.includes(role), [role]);

  // Validación al montar
  useEffect(() => {
    validate();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Revalidación periódica (para “tocar” sesión en backend)
  useEffect(() => {
    if (intervalRef.current) window.clearInterval(intervalRef.current);
    intervalRef.current = window.setInterval(() => {
      // solo revalidamos si está autenticado
      if (isAuth) validate();
    }, VALIDATE_INTERVAL_MS) as unknown as number;

    return () => {
      if (intervalRef.current) window.clearInterval(intervalRef.current);
    };
  }, [isAuth, validate]);

  // Revalidar al recuperar foco/visibilidad (opcional)
  useEffect(() => {
    if (!VALIDATE_ON_VISIBILITY) return;
    const onVisibility = () => {
      if (document.visibilityState === 'visible' && isAuth) validate();
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
