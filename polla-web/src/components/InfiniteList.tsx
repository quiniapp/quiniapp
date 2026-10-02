import { ReactNode, useEffect, useRef } from 'react';

interface InfiniteListProps {
  /** Total real del backend (viene en la primera página). */
  totalCount: number;
  loadedCount: number;
  hasNextPage: boolean;
  isFetchingNextPage: boolean;
  fetchNextPage: () => void;
  children: ReactNode;
}

/**
 * Scroll infinito compartido: un centinela al final de la lista que dispara la
 * página siguiente cuando entra en viewport. Reemplaza al botón de paginar —
 * los endpoints son paginados, la UI es scroll infinito, igual que QuiniApp.
 */
export const InfiniteList = ({
  totalCount,
  loadedCount,
  hasNextPage,
  isFetchingNextPage,
  fetchNextPage,
  children,
}: InfiniteListProps) => {
  const sentinelRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const node = sentinelRef.current;
    if (!node || !hasNextPage) return undefined;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting && !isFetchingNextPage) fetchNextPage();
      },
      // Se anticipa media pantalla para que no se vea el salto.
      { rootMargin: '300px' }
    );

    observer.observe(node);
    return () => observer.disconnect();
  }, [hasNextPage, isFetchingNextPage, fetchNextPage]);

  return (
    <>
      {children}

      <div ref={sentinelRef} aria-hidden className="h-px" />

      <div className="py-3 text-center text-xs text-muted-foreground">
        {isFetchingNextPage
          ? 'Cargando…'
          : totalCount > 0
            ? `${loadedCount} de ${totalCount}`
            : null}
      </div>
    </>
  );
};
