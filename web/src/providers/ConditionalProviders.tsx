import { lazy, Suspense, ReactNode, useState, useEffect, memo } from 'react';
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
 * - Una vez cargados lazy, se mantienen montados durante toda la sesión (evita re-lazy-loading)
 *
 * @param children - Componentes hijos a envolver
 */
export const ConditionalProviders = memo(function ConditionalProviders({ children }: ConditionalProvidersProps) {
  const { isAuth } = useAuth();

  // Estado para cachear si ya se cargaron los providers
  // Una vez true, se mantiene true hasta logout/refresh
  const [shouldLoadProviders, setShouldLoadProviders] = useState(false);

  // Cuando el usuario se autentica por primera vez, activar carga de providers
  // Se mantienen cargados incluso durante transiciones de navegación
  useEffect(() => {
    if (isAuth && !shouldLoadProviders) {
      setShouldLoadProviders(true);
    }
    // Si el usuario cierra sesión explícitamente, desmontar providers
    if (!isAuth && shouldLoadProviders) {
      setShouldLoadProviders(false);
    }
  }, [isAuth, shouldLoadProviders]);

  // Si nunca se ha autenticado, no cargar providers
  if (!shouldLoadProviders) {
    return <>{children}</>;
  }

  // Una vez cargados, mantenerlos montados durante toda la sesión
  // Esto evita el flash de "useClock debe usarse dentro de <ClockProvider>" durante navegación
  return (
    <Suspense fallback={<>{children}</>}>
      <ClockProvider>
        <ModalProvider>
          {children}
        </ModalProvider>
      </ClockProvider>
    </Suspense>
  );
});
