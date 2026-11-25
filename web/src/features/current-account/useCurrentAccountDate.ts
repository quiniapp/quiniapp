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
  const { isPending, isError, data } = useGetCurrentAccountLatestDate(!date);

  const latest: LatestDateState = isPending
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
