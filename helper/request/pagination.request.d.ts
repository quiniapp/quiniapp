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
export interface IPaginationParams {
  page?: number;
  limit?: number;
}
export interface IPaginatedBetsResponse<T> extends IPaginatedResponse<T> {
  aggregates?: {
    totalAmount?: number;
    totalPrize?: number;
    totalCount?: number;
    totalWinnersCount?: number;
  };
}
