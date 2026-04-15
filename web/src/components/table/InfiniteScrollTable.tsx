import { useEffect, useRef } from 'react';
import { useIntersectionObserver } from '@/hooks/useIntersectionObserver';
import { LoadingState } from '../molecules/LoadingState';
import { Text } from '../atoms/Text';

interface InfiniteScrollTableProps<T> {
  data: T[];
  hasNextPage: boolean;
  isFetchingNextPage: boolean;
  fetchNextPage: () => void;
  isLoading: boolean;
  renderHeader: () => React.ReactNode;
  renderRow: (item: T, index: number) => React.ReactNode;
  emptyMessage?: string;
  className?: string;
  triggerIndex?: number; // Índice en el que dispara la carga (ej: 60 para cargar al llegar a la fila 60)
}

export function InfiniteScrollTable<T>({
  data,
  hasNextPage,
  isFetchingNextPage,
  fetchNextPage,
  isLoading,
  renderHeader,
  renderRow,
  emptyMessage = 'No se encontraron registros',
  className = '',
  triggerIndex = 60,
}: InfiniteScrollTableProps<T>) {
  const [triggerRef, isIntersecting] = useIntersectionObserver({
    threshold: 0.1,
    rootMargin: '100px',
  });

  // Ref sincrónico: evita llamadas duplicadas entre el momento en que
  // fetchNextPage() se invoca y el re-render que actualiza isFetchingNextPage.
  const pendingFetchRef = useRef(false);

  useEffect(() => {
    if (!isFetchingNextPage) pendingFetchRef.current = false;

    if (isIntersecting && hasNextPage && !isFetchingNextPage && !pendingFetchRef.current) {
      pendingFetchRef.current = true;
      fetchNextPage();
    }
  }, [isIntersecting, hasNextPage, isFetchingNextPage, fetchNextPage]);

  if (isLoading) {
    return <LoadingState message="Cargando datos..." className="p-8" />;
  }

  if (!data || data.length === 0) {
    return (
      <div className="flex items-center justify-center p-8">
        <Text size="sm" color="muted">{emptyMessage}</Text>
      </div>
    );
  }

  return (
    <div className={`w-full ${className}`}>
      {renderHeader()}
      <div className="w-full">
        {data.map((item, index) => {
          const isTriggerRow = index === Math.min(triggerIndex, data.length - 1);
          return (
            <div key={index} ref={isTriggerRow ? triggerRef : null}>
              {renderRow(item, index)}
            </div>
          );
        })}
      </div>

      {/* Loading indicator */}
      {isFetchingNextPage && (
        <div className="border-t">
          <LoadingState size="sm" message="Cargando más registros..." className="p-4" />
        </div>
      )}

      {/* End of list indicator */}
      {!hasNextPage && data.length > 0 && (
        <div className="flex items-center justify-center p-4 border-t">
          <Text size="sm" color="muted">
            No hay más registros ({data.length} total)
          </Text>
        </div>
      )}
    </div>
  );
}
