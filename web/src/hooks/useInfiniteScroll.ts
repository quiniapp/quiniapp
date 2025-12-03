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
   * Índice de la fila que dispara la carga (default: 75)
   * Cuando esta fila se hace visible, se dispara fetchNextPage
   */
  triggerIndex?: number;
  /**
   * Margen adicional para el IntersectionObserver
   * Por defecto '200px' para prefetch
   */
  rootMargin?: string;
  /**
   * Total de items actualmente cargados
   * Usado para auto-cargar cuando el contenido no llena el viewport
   */
  totalItems?: number;
}

/**
 * Hook para manejar infinite scroll observando una fila específica
 *
 * @example
 * ```tsx
 * const { setTriggerRef, triggerIndex } = useInfiniteScroll({
 *   fetchNextPage,
 *   hasNextPage,
 *   isFetchingNextPage,
 *   root: scrollContainerRef.current,
 *   triggerIndex: 75,
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
  triggerIndex = 75,
  rootMargin = '200px',
  totalItems = 0,
}: UseInfiniteScrollProps) {
  const observerRef = useRef<IntersectionObserver | null>(null);
  const rootRefForEffect = useRef(root);

  // Actualizar ref cuando cambia root
  useEffect(() => {
    rootRefForEffect.current = root;
  }, [root]);

  /**
   * Callback ref que se asigna al elemento trigger (la fila específica)
   */
  const setTriggerRef = useCallback(
    (node: HTMLElement | null) => {
      // Desconectar observer anterior si existe
      if (observerRef.current) {
        observerRef.current.disconnect();
        observerRef.current = null;
      }

      // Solo observar si hay un nodo, hay más páginas y no se está cargando
      if (node && hasNextPage && !isFetchingNextPage) {
        observerRef.current = new IntersectionObserver(
          ([entry]) => {
            if (entry.isIntersecting) {
              fetchNextPage();
            }
          },
          {
            root: rootRefForEffect.current,
            rootMargin,
            threshold: 0,
          }
        );

        observerRef.current.observe(node);
      }
    },
    [fetchNextPage, hasNextPage, isFetchingNextPage, rootMargin]
  );

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

  // Cleanup al desmontar
  useEffect(() => {
    return () => {
      if (observerRef.current) {
        observerRef.current.disconnect();
      }
    };
  }, []);

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
