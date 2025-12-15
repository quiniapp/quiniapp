import { useCallback, useRef } from 'react';
import { ROUTES } from '@/types/routes.type';

/**
 * Mapa de rutas a sus módulos lazy para prefetch
 *
 * Cada ruta apunta a la función de import() que carga su chunk
 * Esto permite pre-cargar módulos antes del click
 *
 * IMPORTANTE: Usa el enum ROUTES para type-safety y mantenibilidad
 * Si cambias una ruta en routes.type.ts, se actualiza automáticamente aquí
 */
const ROUTE_PREFETCH_MAP: Partial<Record<ROUTES, () => Promise<any>>> = {
  [ROUTES.HOME]: () => import('@/pages'),
  [ROUTES.MAKE_PLAYS]: () => import('@/pages/MakePlays'),
  [ROUTES.PLAYS_AND_HITS]: () => import('@/pages/plays-and-hits'),
  [ROUTES.TERMINAL_TICKET]: () => import('@/pages/terminal-ticket'),
  [ROUTES.RESULTS]: () => import('@/pages/results'),
  [ROUTES.CLIENTS]: () => import('@/pages/clients'),
  [ROUTES.CURRENT_ACCOUNT]: () => import('@/pages/current-account'),
  [ROUTES.SHIFTS]: () => import('@/pages/shifts'),
  [ROUTES.USERS]: () => import('@/pages/users'),
  [ROUTES.USERS_LIST]: () => import('@/pages/user-list'),
  [ROUTES.REPORTS]: () => import('@/pages/reports'),
  [ROUTES.SETTINGS]: () => import('@/pages/settings'),
  [ROUTES.LOTTERIES]: () => import('@/pages/upcoming-lotteries'),
  [ROUTES.GROUPS]: () => import('@/pages/groups'),
  [ROUTES.NEW_USER]: () => import('@/pages/new-user.tsx'),
  [ROUTES.RESET_PASSWORD]: () => import('@/pages/ResetPassword'),
};

/**
 * Hook para prefetch de rutas lazy
 *
 * Optimización de performance que pre-carga chunks de rutas cuando
 * el usuario hace hover sobre links del sidebar.
 *
 * Beneficios:
 * - Ganancia de 200-500ms en tiempo de respuesta al hacer click
 * - Navegación instantánea si el chunk ya está cargado
 * - Solo carga una vez por ruta (cachea en memoria)
 * - No afecta performance si el usuario no hace hover
 * - Type-safe: usa enum ROUTES para validación de tipos
 *
 * @example
 * ```tsx
 * const prefetch = usePrefetchRoute();
 *
 * // Usando enum (recomendado - type-safe)
 * <a
 *   onMouseEnter={() => prefetch(ROUTES.MAKE_PLAYS)}
 *   onClick={() => navigate(ROUTES.MAKE_PLAYS)}
 * >
 *   Hacer Jugadas
 * </a>
 *
 * // Usando string (también soportado)
 * <a
 *   onMouseEnter={() => prefetch('/make-plays')}
 *   onClick={() => navigate('/make-plays')}
 * >
 *   Hacer Jugadas
 * </a>
 * ```
 */
export function usePrefetchRoute() {
  // Cache de rutas ya pre-cargadas (evita cargar múltiples veces)
  const prefetchedRoutes = useRef<Set<string>>(new Set());

  const prefetch = useCallback((route: string | ROUTES) => {
    // Convertir enum a string si es necesario
    const routePath = route.toString();

    // Si ya se pre-cargó esta ruta, no hacer nada
    if (prefetchedRoutes.current.has(routePath)) {
      return;
    }

    // Buscar la función de import para esta ruta (type-safe con as)
    const importFn = ROUTE_PREFETCH_MAP[route as ROUTES];

    if (!importFn) {
      // Ruta no encontrada en el mapa (puede ser una ruta sin lazy load o login)
      return;
    }

    // Marcar como pre-cargada ANTES de ejecutar (evita duplicados)
    prefetchedRoutes.current.add(routePath);

    // Pre-cargar el módulo en background
    importFn()
      .then(() => {
        // Módulo cargado exitosamente - ya está en caché de Vite/browser
        console.debug(`[Prefetch] ✓ Ruta pre-cargada: ${routePath}`);
      })
      .catch((error) => {
        // Error al cargar - remover de caché para reintento
        prefetchedRoutes.current.delete(routePath);
        console.warn(`[Prefetch] ✗ Error pre-cargando ${routePath}:`, error);
      });
  }, []);

  return prefetch;
}
