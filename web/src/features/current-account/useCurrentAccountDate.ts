import { useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import dayjs from 'dayjs';
import { useGetCurrentAccountLatestDate } from '@/hooks/fetchs/current-account/useGetCurrentAccountLatestDate';
import { resolveCurrentAccountDate, type LatestDateState } from './resolveDate';

/**
 * Deja la fecha de la Cta Cte en la URL (`?date=`). Si no viene, la completa con
 * la última liquidación (o hoy). Devuelve la fecha de la URL; `null` mientras se resuelve.
 */
export function useCurrentAccountDate(): string | null {
  const [searchParams, setSearchParams] = useSearchParams();
  const date = searchParams.get('date');
  const { isPending, isFetching, isError, data } = useGetCurrentAccountLatestDate(!date);

  // Mientras hay una búsqueda en curso (aunque haya un valor en caché de antes) se espera
  // la fecha fresca: si no, podría escribirse en la URL una última liquidación vieja.
  const latest: LatestDateState =
    isPending || isFetching
      ? { status: 'pending' }
      : isError
        ? { status: 'error' }
        : { status: 'success', date: data ?? null };
  const resolved = resolveCurrentAccountDate(date, latest, dayjs().format('YYYY-MM-DD'));

  useEffect(() => {
    if (date || !resolved) return;
    const params = new URLSearchParams(searchParams);
    params.set('date', resolved);
    setSearchParams(params, { replace: true });
  }, [date, resolved, searchParams, setSearchParams]);

  return date ?? null;
}
