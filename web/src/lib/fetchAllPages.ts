/**
 * Tamaño de página para traer un listado completo. El backend lo topea en 900
 * (`MAX_PAGE_SIZE` en `api/src/utils/keyset.ts`): PostgREST corta cada
 * respuesta en 1000 filas y el keyset pide una de más.
 */
export const ALL_PAGES_SIZE = 900;

interface KeysetPage<T> {
  data: T[];
  pagination: { hasMore: boolean; next_cursor?: string | null };
}

/**
 * Recorre un listado keyset hasta el final, siguiendo `next_cursor`. Para lo
 * que necesita todas las filas y no solo la primera página: totales de la
 * cuenta corriente, PDF de liquidación, impresión de jugadas.
 */
export async function fetchAllPages<T>(
  fetchPage: (cursor: string) => Promise<KeysetPage<T>>
): Promise<T[]> {
  const rows: T[] = [];
  let cursor = '';
  for (;;) {
    const { data, pagination } = await fetchPage(cursor);
    rows.push(...data);
    if (!pagination.hasMore || !pagination.next_cursor) return rows;
    cursor = pagination.next_cursor;
  }
}
