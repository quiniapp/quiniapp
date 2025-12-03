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

  console.log('🔄 [useInfiniteScroll] Hook ejecutado con:', {
    triggerIndex,
    totalItems,
    offsetFromEnd,
    hasNextPage,
    isFetchingNextPage,
    observedIndices: Array.from(observedElementsRef.current.keys()),
    root: root ? 'presente' : 'null',
    rootMargin,
  });

  // Mantener refs actualizadas
  useEffect(() => {
    fetchNextPageRef.current = fetchNextPage;
    hasNextPageRef.current = hasNextPage;
    isFetchingNextPageRef.current = isFetchingNextPage;
  });

  // Limpiar elementos observados de índices antiguos
  useEffect(() => {
    // Eliminar elementos de índices que ya no son el trigger actual
    const currentElements = observedElementsRef.current.get(triggerIndex);
    observedElementsRef.current.clear();
    if (currentElements) {
      observedElementsRef.current.set(triggerIndex, currentElements);
    }
    console.log('🧹 [Effect Cleanup Old] Limpiando índices antiguos, actual:', triggerIndex);
  }, [triggerIndex]);

  // Crear o recrear observer cuando cambian las configuraciones
  useEffect(() => {
    console.log('🔄 [Effect] Recreando observer:', {
      triggerIndex,
      hasNextPage,
      isFetchingNextPage,
      totalItems,
    });

    // Desconectar observer anterior
    if (observerRef.current) {
      console.log('🧹 [Effect] Desconectando observer anterior');
      observerRef.current.disconnect();
      observerRef.current = null;
    }

    // Crear nuevo observer
    if (hasNextPage && !isFetchingNextPage) {
      console.log('✅ [Effect] Creando nuevo observer');
      observerRef.current = new IntersectionObserver(
        (entries) => {
          entries.forEach((entry) => {
            const isVisible = (entry.target as HTMLElement).offsetParent !== null;

            console.log('👁️ [Observer Callback] Entry:', {
              isIntersecting: entry.isIntersecting,
              intersectionRatio: entry.intersectionRatio,
              hasNextPage: hasNextPageRef.current,
              isFetchingNextPage: isFetchingNextPageRef.current,
              target: entry.target.nodeName,
              targetVisible: isVisible,
              currentTriggerIndex: triggerIndex,
              lastTriggerIndex: lastTriggerIndexRef.current,
            });

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
              console.log('🚀 [Observer Callback] Disparando fetchNextPage!');
              lastTriggerIndexRef.current = triggerIndex;
              fetchNextPageRef.current();
            } else {
              console.log('❌ [Observer Callback] No se dispara porque:', {
                isIntersecting: entry.isIntersecting,
                hasNextPage: hasNextPageRef.current,
                isFetchingNextPage: isFetchingNextPageRef.current,
                isVisible,
                isNewTrigger: lastTriggerIndexRef.current !== triggerIndex,
                lastTrigger: lastTriggerIndexRef.current,
                currentTrigger: triggerIndex,
              });
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
            console.log('🔗 [Effect] Re-observando elemento:', element.nodeName);
            observerRef.current.observe(element);
          }
        });
      }
    }

    return () => {
      if (observerRef.current) {
        console.log('🧹 [Effect Cleanup] Desconectando observer');
        observerRef.current.disconnect();
      }
    };
  }, [root, rootMargin, hasNextPage, isFetchingNextPage, triggerIndex]);

  /**
   * Callback ref que maneja múltiples elementos por índice
   */
  const setTriggerRef = useCallback((node: HTMLElement | null) => {
    console.log('📍 [setTriggerRef] Nodo asignado:', {
      node: node ? 'elemento presente' : 'null',
      nodeType: node?.nodeName,
      isVisible: node ? (node as HTMLElement).offsetParent !== null : false,
      triggerIndex,
      totalItems,
    });

    if (!node) {
      console.log('⚠️ [setTriggerRef] Nodo null (desmontaje), no se hace nada');
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
    console.log('📦 [setTriggerRef] Elementos en índice', triggerIndex, ':', elementsAtIndex.size);

    // Si hay observer activo, observar el nuevo elemento
    if (observerRef.current) {
      console.log('🔗 [setTriggerRef] Observando nuevo elemento');
      observerRef.current.observe(node);
    } else {
      console.log('⚠️ [setTriggerRef] No hay observer activo aún');
    }
  }, [triggerIndex, totalItems]);

  // Cleanup al desmontar
  useEffect(() => {
    return () => {
      console.log('🧹 [Cleanup Final] Limpiando todo');
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
    console.log('📏 [Effect Auto-Load] Verificando si necesita auto-cargar:', {
      root: root ? 'presente' : 'null',
      scrollHeight: root?.scrollHeight,
      clientHeight: root?.clientHeight,
      hasNextPage,
      isFetchingNextPage,
      totalItems,
    });

    if (!root) {
      console.log('⚠️ [Effect Auto-Load] No hay root, saliendo');
      return;
    }

    // Si el contenido no llena el contenedor y hay más páginas, cargar automáticamente
    if (root.scrollHeight <= root.clientHeight && hasNextPage && !isFetchingNextPage) {
      console.log('🚀 [Effect Auto-Load] Auto-cargando porque el contenido no llena el viewport');
      fetchNextPage();
    } else {
      console.log('✅ [Effect Auto-Load] No se necesita auto-cargar');
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
