import { Navigate, Outlet, useLocation } from 'react-router-dom'
import { useAuth } from '@/contexts/AuthContext';
import { ROUTES } from '@/types/routes.type';

interface ProtectedRouteProps {
  children: React.ReactNode;
}

const ProtectedRoute = ({ children }: ProtectedRouteProps) => {
  const { isAuth, loading } = useAuth();
  const location = useLocation();

  if (loading) return <div style={{ padding: 24 }}>Cargando…</div>;
  if (!isAuth) return <Navigate to={ROUTES.LOGIN} replace state={{ from: location }} />;

  // Soporta <ProtectedRoute><Layout/></ProtectedRoute> O bien rutas anidadas con <Outlet/>
  return children ? <>{children}</> : <Outlet />;
};

export default ProtectedRoute;
