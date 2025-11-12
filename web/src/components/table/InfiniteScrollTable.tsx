import { useEffect } from 'react';
import { Loader2 } from 'lucide-react';
import { useIntersectionObserver } from '@/hooks/useIntersectionObserver';

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
  // Ref para el trigger element
  const [triggerRef, isIntersecting] = useIntersectionObserver({
    threshold: 0.1,
    rootMargin: '100px',
  });

  // Detectar cuando el elemento trigger es visible
  useEffect(() => {
    if (isIntersecting && hasNextPage && !isFetchingNextPage) {
      fetchNextPage();
    }
  }, [isIntersecting, hasNextPage, isFetchingNextPage, fetchNextPage]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-8">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
        <span className="ml-2 text-sm">Cargando datos...</span>
      </div>
    );
  }

  if (!data || data.length === 0) {
    return (
      <div className="flex items-center justify-center p-8">
        <p className="text-sm text-muted-foreground">{emptyMessage}</p>
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
        <div className="flex items-center justify-center p-4 border-t">
          <Loader2 className="w-5 h-5 animate-spin text-primary mr-2" />
          <span className="text-sm text-muted-foreground">Cargando más registros...</span>
        </div>
      )}

      {/* End of list indicator */}
      {!hasNextPage && data.length > 0 && (
        <div className="flex items-center justify-center p-4 border-t">
          <span className="text-sm text-muted-foreground">
            No hay más registros ({data.length} total)
          </span>
        </div>
      )}
    </div>
  );
}
