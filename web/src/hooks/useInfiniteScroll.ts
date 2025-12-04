import { useCallback, useEffect, useRef } from 'react';

interface UseInfiniteScrollProps {
  /**
   * Función para cargar la siguiente página
   */
  fetchNextPage: () => void;
  /**
   * Indica si hay más páginas disponibles
   */
  hasNextPage: boolean;
  /**
   * Indica si se está cargando la siguiente página
   */
  isFetchingNextPage: boolean;
  /**
   * Elemento root para el IntersectionObserver (el contenedor que scrollea)
   */
  root?: HTMLElement | null;
  /**
   * Offset desde el final para disparar la carga (default: 75)
   * Ej: Si offset=75 y totalItems=150, se dispara en el índice 75 (150-75)
   * Cuando se cargan más items y totalItems=300, se dispara en el índice 225 (300-75)
   */
  offsetFromEnd?: number;
  /**
   * Margen adicional para el IntersectionObserver
   * Por defecto '200px' para prefetch
   */
  rootMargin?: string;
  /**
   * Total de items actualmente cargados
   * Usado para calcular el índice de disparo dinámicamente
   */
  totalItems?: number;
}

/**
 * Hook para manejar infinite scroll observando una fila dinámica
 *
 * @example
 * ```tsx
 * const { setTriggerRef, triggerIndex } = useInfiniteScroll({
 *   fetchNextPage,
 *   hasNextPage,
 *   isFetchingNextPage,
 *   root: scrollContainerRef.current,
 *   offsetFromEnd: 75, // Dispara cuando faltan 75 filas para el final
 *   totalItems: items.length
 * });
 *
 * // En el map de items
 * {items.map((item, index) => (
 *   <TableRow
 *     key={item.id}
 *     ref={index === triggerIndex ? setTriggerRef : undefined}
 *   >
 *     ...
 *   </TableRow>
 * ))}
 * ```
 */
export function useInfiniteScroll({
  fetchNextPage,
  hasNextPage,
  isFetchingNextPage,
  root = null,
  offsetFromEnd = 75,
  rootMargin = '200px',
  totalItems = 0,
}: UseInfiniteScrollProps) {
  // Calcular el índice de disparo dinámicamente
  const triggerIndex = Math.max(0, totalItems - offsetFromEnd);
  const observerRef = useRef<IntersectionObserver | null>(null);
  const observedElementsRef = useRef<Map<number, Set<HTMLElement>>>(new Map());
  const fetchNextPageRef = useRef(fetchNextPage);
  const hasNextPageRef = useRef(hasNextPage);
  const isFetchingNextPageRef = useRef(isFetchingNextPage);
  const lastTriggerIndexRef = useRef<number>(-1);

  // Mantener refs actualizadas
  useEffect(() => {
    fetchNextPageRef.current = fetchNextPage;
    hasNextPageRef.current = hasNextPage;
    isFetchingNextPageRef.current = isFetchingNextPage;
  });

  // Limpiar elementos observados de índices antiguos
  useEffect(() => {
    const currentElements = observedElementsRef.current.get(triggerIndex);
    observedElementsRef.current.clear();
    if (currentElements) {
      observedElementsRef.current.set(triggerIndex, currentElements);
    }
  }, [triggerIndex]);

  // Crear o recrear observer cuando cambian las configuraciones
  useEffect(() => {
    // Desconectar observer anterior
    if (observerRef.current) {
      observerRef.current.disconnect();
      observerRef.current = null;
    }

    // Crear nuevo observer
    if (hasNextPage && !isFetchingNextPage) {
      observerRef.current = new IntersectionObserver(
        (entries) => {
          entries.forEach((entry) => {
            const isVisible = (entry.target as HTMLElement).offsetParent !== null;

            // Solo disparar si:
            // 1. El elemento está intersectando
            // 2. Hay más páginas
            // 3. No se está cargando
            // 4. Es un trigger nuevo (no el mismo que ya disparó)
            // 5. El elemento está visible (no oculto con CSS)
            if (
              entry.isIntersecting &&
              hasNextPageRef.current &&
              !isFetchingNextPageRef.current &&
              isVisible &&
              lastTriggerIndexRef.current !== triggerIndex
            ) {
              lastTriggerIndexRef.current = triggerIndex;
              fetchNextPageRef.current();
            }
          });
        },
        {
          root,
          rootMargin,
          threshold: 0,
        }
      );

      // Re-observar solo los elementos del índice actual
      const currentElements = observedElementsRef.current.get(triggerIndex);
      if (currentElements) {
        currentElements.forEach((element) => {
          if (observerRef.current) {
            observerRef.current.observe(element);
          }
        });
      }
    }

    return () => {
      if (observerRef.current) {
        observerRef.current.disconnect();
      }
    };
  }, [root, rootMargin, hasNextPage, isFetchingNextPage, triggerIndex]);

  /**
   * Callback ref que maneja múltiples elementos por índice
   */
  const setTriggerRef = useCallback((node: HTMLElement | null) => {
    if (!node) {
      return;
    }

    // Obtener o crear el set para este índice
    let elementsAtIndex = observedElementsRef.current.get(triggerIndex);
    if (!elementsAtIndex) {
      elementsAtIndex = new Set();
      observedElementsRef.current.set(triggerIndex, elementsAtIndex);
    }

    // Agregar elemento al set de este índice
    elementsAtIndex.add(node);

    // Si hay observer activo, observar el nuevo elemento
    if (observerRef.current) {
      observerRef.current.observe(node);
    }
  }, [triggerIndex, totalItems]);

  // Cleanup al desmontar
  useEffect(() => {
    return () => {
      if (observerRef.current) {
        observerRef.current.disconnect();
      }
      observedElementsRef.current.clear();
    };
  }, []);

  /**
   * Auto-cargar cuando el contenido no llena el viewport
   * Útil para la carga inicial o cuando hay pocos items
   */
  useEffect(() => {
    if (!root) return;

    // Si el contenido no llena el contenedor y hay más páginas, cargar automáticamente
    if (root.scrollHeight <= root.clientHeight && hasNextPage && !isFetchingNextPage) {
      fetchNextPage();
    }
  }, [totalItems, hasNextPage, isFetchingNextPage, fetchNextPage, root]);

  return {
    /**
     * Ref callback para asignar al elemento que dispara la carga
     */
    setTriggerRef,
    /**
     * Índice configurado para disparar la carga
     */
    triggerIndex,
  };
}
