export type LatestDateState =
  { status: 'pending' } | { status: 'error' } | { status: 'success'; date: string | null };

/**
 * Fecha con la que arranca la Cta Cte. La URL gana; si no hay, la última
 * liquidación; sin liquidaciones o si el endpoint falla, hoy. `null` mientras
 * se está resolviendo.
 */
export function resolveCurrentAccountDate(
  urlDate: string | null,
  latest: LatestDateState,
  today: string
): string | null {
  if (urlDate) return urlDate;
  if (latest.status === 'pending') return null;
  if (latest.status === 'error') return today;
  return latest.date ?? today;
}
