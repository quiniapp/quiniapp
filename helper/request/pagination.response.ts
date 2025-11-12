// Interfaz genérica para respuestas paginadas
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

// Interfaz específica para respuesta paginada de bets con agregados
export interface IPaginatedBetsResponse<T> extends IPaginatedResponse<T> {
  aggregates?: {
    totalAmount?: number;
    totalPrize?: number;
  };
}
