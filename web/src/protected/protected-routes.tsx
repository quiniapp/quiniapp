//import { Navigate, useLocation } from "react-router-dom";
//import { Spinner } from '@/components/ui/spinner.tsx';

interface ProtectedRouteProps {
  children: React.ReactNode;
  requiredPermission?: string;
  redirectUnauthenticatedTo?: string;
  redirectUnauthorizedTo?: string;
}

const ProtectedRoute = ({
                          children,
                          //requiredPermission,
                          //redirectUnauthenticatedTo = "/login",
                         // redirectUnauthorizedTo = "/dashboard",
                        }: ProtectedRouteProps) => {
  //const { user, loading, hasPermission } = useAuth();
 // const location = useLocation();
  {/*
    if (loading) {
      return (
        <div className="flex items-center justify-center min-h-screen">
          <Spinner />
        </div>
      );
    }

    if (!user) {
      return <Navigate to={redirectUnauthenticatedTo} state={{ from: location }} replace />;
    }

    if (requiredPermission && !hasPermission(requiredPermission)) {
      return <Navigate to={redirectUnauthorizedTo} replace />;
    }
  */
  }
  return <>{children}</>;
};

export default ProtectedRoute;