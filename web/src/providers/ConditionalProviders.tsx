import { lazy, Suspense, ReactNode } from 'react';
import { useAuth } from '@/contexts/AuthContext';

// Lazy load providers pesados solo cuando el usuario está autenticado
const ClockProvider = lazy(() =>
  import('./ClockProvider').then(module => ({ default: module.ClockProvider }))
);
const ModalProvider = lazy(() =>
  import('./modal-provider').then(module => ({ default: module.ModalProvider }))
);

interface ConditionalProvidersProps {
  children: ReactNode;
}

/**
 * ConditionalProviders - Carga providers pesados solo si el usuario está autenticado
 *
 * Optimización de performance:
 * - ClockProvider (~50KB con dayjs + plugins) solo se carga para usuarios autenticados
 * - ModalProvider solo se carga para usuarios autenticados
 * - Usuarios en /login no descargan estos providers innecesariamente
 *
 * @param children - Componentes hijos a envolver
 */
export function ConditionalProviders({ children }: ConditionalProvidersProps) {
  const { isAuth } = useAuth();

  // Si no está autenticado, renderizar children directamente
  // No necesitamos ClockProvider ni ModalProvider en la página de login
  if (!isAuth) {
    return <>{children}</>;
  }

  // Si está autenticado, lazy-load los providers
  // Suspense sin fallback para que no haya flash de loading
  return (
    <Suspense fallback={<>{children}</>}>
      <ClockProvider>
        <ModalProvider>
          {children}
        </ModalProvider>
      </ClockProvider>
    </Suspense>
  );
}
