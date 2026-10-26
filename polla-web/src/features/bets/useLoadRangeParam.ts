import { useSearchParams } from 'react-router-dom';
import type { LoadRange } from './LoadDateFilter';

/**
 * Días de carga de la URL (`load_from`/`load_to`) en Jugadas y Administrar
 * jugadas. Desde y hasta viajan juntos en la URL (la API pide los dos).
 */
export const useLoadRangeParam = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const loadFrom = searchParams.get('load_from');
  const loadTo = searchParams.get('load_to');
  const loadRange: LoadRange | null = loadFrom && loadTo ? { from: loadFrom, to: loadTo } : null;

  const changeLoadRange = (range: LoadRange | null) => {
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev);
      if (range) {
        next.set('load_from', range.from);
        next.set('load_to', range.to);
      } else {
        next.delete('load_from');
        next.delete('load_to');
      }
      return next;
    });
  };

  return [loadRange, changeLoadRange] as const;
};
