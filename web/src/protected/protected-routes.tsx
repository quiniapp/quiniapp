import { Navigate, Outlet, useLocation } from 'react-router-dom'
import { useAuth } from '@/contexts/AuthContext';
import { LayoutSkeleton } from '@/components/skeletons/LayoutSkeleton';
import { ROUTES } from '@/types/routes.type';

interface ProtectedRouteProps {
  children: React.ReactNode;
}

const ProtectedRoute = ({ children }: ProtectedRouteProps) => {
  const { isAuth, loading, optimisticAuth } = useAuth();
  const location = useLocation();

  // Mientras valida: si el usuario estaba autenticado en esta sesión mostramos
  // el skeleton de la app en lugar de pantalla en blanco (mejora LCP móvil)
  if (loading) return <LayoutSkeleton />;
  if (!isAuth) return <Navigate to={ROUTES.LOGIN} replace state={{ from: location }} />;

  // Soporta <ProtectedRoute><Layout/></ProtectedRoute> O bien rutas anidadas con <Outlet/>
  return children ? <>{children}</> : <Outlet />;
};

export default ProtectedRoute;
