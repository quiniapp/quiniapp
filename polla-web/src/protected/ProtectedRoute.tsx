import { ReactNode } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { POLLA_USER_TYPE } from '@helper/polla/types/user.type';
import { useAuth } from '@/providers/AuthContext';
import { ROUTES } from '@/types/routes.type';

const Splash = () => (
  <div className="flex h-screen w-full items-center justify-center text-muted-foreground">
    Cargando…
  </div>
);

export const ProtectedRoute = ({ children }: { children: ReactNode }) => {
  const { isAuth, loading, user } = useAuth();
  const location = useLocation();

  if (loading) return <Splash />;
  if (!isAuth) return <Navigate to={ROUTES.LOGIN} replace />;

  // Contraseña inicial (OWNER del seed): no se puede usar la app hasta
  // cambiarla. Fuera de ese caso nadie se cambia la contraseña.
  const mustChangePassword = Boolean(user?.password_reset_required);
  const onChangePassword = location.pathname === ROUTES.CHANGE_PASSWORD;

  if (mustChangePassword && !onChangePassword) {
    return <Navigate to={ROUTES.CHANGE_PASSWORD} replace />;
  }
  if (!mustChangePassword && onChangePassword) {
    return <Navigate to={ROUTES.BETS} replace />;
  }

  return <>{children}</>;
};

/**
 * Gateo de rol a nivel de ruta, no solo de menú: en QuiniApp cualquiera puede
 * entrar por URL a una pantalla que el menú le esconde.
 */
export const RoleRoute = ({
  allow,
  children,
}: {
  allow: POLLA_USER_TYPE[];
  children: ReactNode;
}) => {
  const { role, loading } = useAuth();

  if (loading) return <Splash />;
  if (!role || !allow.includes(role)) return <Navigate to={ROUTES.BETS} replace />;

  return <>{children}</>;
};
