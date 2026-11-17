// Interfaz genérica para respuestas paginadas por offset (`page`)
export interface IPaginatedResponse<T> {
  data: T[];
  pagination: {
    currentPage: number;
    pageSize: number;
    totalCount: number;
    totalPages: number;
    hasMore: boolean;
  };
}

// Parámetros de paginación para requests
export interface IPaginationParams {
  page?: number;
  limit?: number;
}

/**
 * Paginación keyset (cursor). Ver CLAUDE.md, "SQL Performance".
 * - `hasMore` sale de pedir `limit + 1` filas, no de un count.
 * - `totalCount` cubre todo el set filtrado y solo viene en la primera request
 *   (sin cursor), en los listados cuya UI lo muestra.
 */
export interface IKeysetPagination {
  pageSize: number;
  hasMore: boolean;
  /** Cursor de la página siguiente; `null` cuando no hay más. */
  next_cursor: string | null;
  totalCount?: number;
}

export interface IKeysetPaginatedResponse<T> {
  data: T[];
  pagination: IKeysetPagination;
}

/**
 * Jugadas: el modo lista pagina con cursor (`next_cursor`) y el agrupado con
 * offset (`currentPage`, `totalCount`, `totalPages`).
 */
export interface IBetsPagination {
  pageSize: number;
  hasMore: boolean;
  /** Modo lista (keyset). */
  next_cursor?: string | null;
  /** Modo agrupado (offset). */
  currentPage?: number;
  totalCount?: number;
  totalPages?: number;
}

// Respuesta paginada de bets con agregados
export interface IPaginatedBetsResponse<T> {
  data: T[];
  pagination: IBetsPagination;
  /**
   * Totales del set filtrado completo; solo en la primera request (sin cursor /
   * `page=1`). Usan los filtros base (organización, fecha, turno, pasador,
   * quiniela, grupo): ignoran ganadores, terna, cuaterna y monto mínimo.
   */
  aggregates?: {
    totalAmount?: number;
    totalPrize?: number;
  };
}
