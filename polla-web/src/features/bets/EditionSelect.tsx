import { UIEvent, useEffect, useRef, useState } from 'react';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { shouldLoadMore } from '@/lib/editionSelect';

/**
 * Select de ediciones con scroll infinito dentro del desplegable: trae la
 * página siguiente al llegar al final. Si la elegida no está en las páginas
 * cargadas, `selectedFallback` se muestra en el selector (su rótulo) pero no
 * se agrega a la lista de opciones.
 */
export const EditionSelect = <T,>({
  items,
  value,
  onChange,
  idOf,
  labelOf,
  hasNextPage,
  isFetchingNextPage,
  fetchNextPage,
  selectedFallback,
  placeholder = 'Elegí una edición',
}: {
  items: T[];
  value: string;
  onChange: (id: string) => void;
  idOf: (item: T) => string;
  labelOf: (item: T) => string;
  hasNextPage: boolean;
  isFetchingNextPage: boolean;
  fetchNextPage: () => void;
  selectedFallback?: T;
  placeholder?: string;
}) => {
  const options = items;
  // Un solo pedido por tanto: el scroll y el observer pueden pedir la misma
  // página en el mismo instante. Se libera al cambiar la cantidad de opciones
  // o al terminar de traer.
  const requested = useRef(false);
  useEffect(() => {
    requested.current = false;
  }, [options.length, isFetchingNextPage]);
  const loadMore = () => {
    if (requested.current) return;
    requested.current = true;
    fetchNextPage();
  };

  // Centinela al final de la lista: si queda a la vista (la lista no llena el
  // panel y no hay scroll, o se llegó al final) se trae la página siguiente.
  // El efecto se rearma con cada página para volver a medir.
  const [sentinel, setSentinel] = useState<HTMLDivElement | null>(null);
  useEffect(() => {
    if (!sentinel || !hasNextPage || isFetchingNextPage) return;
    const observer = new IntersectionObserver((entries) => {
      if (entries.some((e) => e.isIntersecting)) loadMore();
    });
    observer.observe(sentinel);
    return () => observer.disconnect();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- loadMore solo usa refs y fetchNextPage
  }, [sentinel, hasNextPage, isFetchingNextPage, fetchNextPage, options.length]);

  const onScroll = (e: UIEvent<HTMLDivElement>) => {
    if (hasNextPage && !isFetchingNextPage && shouldLoadMore(e.currentTarget)) loadMore();
  };

  return (
    <Select value={value} onValueChange={onChange}>
      <SelectTrigger>
        {selectedFallback && !items.some((i) => idOf(i) === value) ? (
          <SelectValue>{labelOf(selectedFallback)}</SelectValue>
        ) : (
          <SelectValue placeholder={placeholder} />
        )}
      </SelectTrigger>
      <SelectContent onViewportScroll={onScroll}>
        {options.map((item) => (
          <SelectItem key={idOf(item)} value={idOf(item)}>
            {labelOf(item)}
          </SelectItem>
        ))}
        {hasNextPage && <div ref={setSentinel} aria-hidden className="h-px" />}
        {isFetchingNextPage && (
          <div
            role="status"
            aria-live="polite"
            className="px-2 py-1.5 text-xs text-muted-foreground"
          >
            Cargando…
          </div>
        )}
      </SelectContent>
    </Select>
  );
};
