import { APIResponse, ErrorResponse } from '@helper/response/api_response.response';
import { dispatchAuthExpired } from './authEvents';

export class ApiError extends Error {
  public readonly statusCode: number;
  public readonly errorCode?: string;
  public readonly details?: unknown;

  constructor(statusCode: number, errorResponse: ErrorResponse) {
    super(errorResponse.message);
    this.name = 'ApiError';
    this.statusCode = statusCode;
    this.errorCode = errorResponse.code || String(errorResponse.error);
    this.details = errorResponse.details;
  }
}

export interface RequestConfig extends RequestInit {
  params?: Record<string, string | number | boolean | undefined>;
  _skipRefreshRetry?: boolean; // Internal flag to prevent infinite refresh loops
}

type PendingRequest = {
  resolve: (value: unknown) => void;
  reject: (error: unknown) => void;
};

class ApiClient {
  private baseURL: string;
  private isRefreshing = false;
  private refreshQueue: PendingRequest[] = [];

  constructor(baseURL: string = '') {
    this.baseURL = baseURL;
  }

  /**
   * Refresh the access token using the refresh token cookie
   */
  private async refreshAccessToken(): Promise<boolean> {
    try {
      const response = await fetch('/api/auth/refresh', {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      // If no refresh token is available (old session), return false
      // This will trigger logout in the handler
      if (!response.ok) {
        return false;
      }

      return true;
    } catch {
      return false;
    }
  }

  /**
   * Process all pending requests after token refresh
   */
  private processPendingRequests(error: unknown | null): void {
    this.refreshQueue.forEach((pending) => {
      if (error) {
        pending.reject(error);
      } else {
        pending.resolve(null);
      }
    });
    this.refreshQueue = [];
  }

  private buildURL(endpoint: string, params?: Record<string, any>): string {
    const url = new URL(endpoint, window.location.origin);

    if (params) {
      Object.entries(params).forEach(([key, value]) => {
        if (value !== undefined && value !== null) {
          url.searchParams.append(key, String(value));
        }
      });
    }

    return url.toString();
  }

  private async request<T>(endpoint: string, config: RequestConfig = {}): Promise<T> {
    const { params, _skipRefreshRetry, ...fetchConfig } = config;

    const url = this.buildURL(endpoint, params);

    try {
      const response = await fetch(url, {
        credentials: 'include', // Siempre incluir cookies
        headers: {
          'Content-Type': 'application/json',
          ...fetchConfig.headers,
        },
        ...fetchConfig,
      });

      // Parse response body
      const contentType = response.headers.get('content-type');
      let data: APIResponse<T>;

      if (contentType?.includes('application/json')) {
        data = await response.json();
      } else {
        throw new ApiError(response.status, {
          code: 'INVALID_RESPONSE',
          message: `Formato de respuesta inválido: ${contentType}`,
        });
      }

      // Check for error response
      if (!response.ok || data.error) {
        const apiError = new ApiError(
          response.status,
          data.error || {
            code: 'UNKNOWN_ERROR',
            message: `La solicitud falló con estado ${response.status}`,
          }
        );

        // Handle 401 Unauthorized - attempt token refresh
        if (response.status === 401 && !_skipRefreshRetry) {
          return this.handleUnauthorized(endpoint, config);
        }

        throw apiError;
      }

      // Extract data from APIResponse wrapper
      const responseData = data.data;
      if (!responseData) {
        throw new ApiError(response.status, {
          code: 'EMPTY_RESPONSE',
          message: 'La respuesta no contiene datos',
        });
      }

      // Return the actual data (first value from the data object)
      return Object.values(responseData)[0] as T;
    } catch (err) {
      // Handle 401 in catch block as well (for thrown ApiErrors)
      if (err instanceof ApiError && err.statusCode === 401 && !_skipRefreshRetry) {
        return this.handleUnauthorized(endpoint, config);
      }

      // Network errors (no response from server)
      if (err instanceof TypeError && err.message.includes('fetch')) {
        throw new ApiError(0, {
          code: 'NETWORK_ERROR',
          message: 'No se pudo conectar con el servidor. Verifique su conexión.',
        });
      }
      throw err;
    }
  }

  /**
   * Handle 401 Unauthorized by refreshing token and retrying request
   */
  private async handleUnauthorized<T>(endpoint: string, config: RequestConfig): Promise<T> {
    // If already refreshing, queue this request
    if (this.isRefreshing) {
      return new Promise<T>((resolve, reject) => {
        this.refreshQueue.push({
          resolve: () => {
            // Retry the original request after refresh completes
            this.request<T>(endpoint, { ...config, _skipRefreshRetry: true })
              .then(resolve)
              .catch(reject);
          },
          reject,
        });
      });
    }

    // Start refresh process
    this.isRefreshing = true;

    try {
      const refreshSuccess = await this.refreshAccessToken();

      if (refreshSuccess) {
        // Process queued requests
        this.processPendingRequests(null);

        // Retry the original request with new token
        return await this.request<T>(endpoint, { ...config, _skipRefreshRetry: true });
      } else {
        // Refresh failed - notify AuthProvider to logout
        dispatchAuthExpired();
        const refreshError = new ApiError(401, {
          code: 'REFRESH_FAILED',
          message: 'Ususario o contraseña incorrectas.',
        });
        this.processPendingRequests(refreshError);
        throw refreshError;
      }
    } finally {
      this.isRefreshing = false;
    }
  }

  /**
   * Proactive token refresh that respects the isRefreshing mutex.
   * Use this instead of posting to /auth/refresh directly to avoid
   * concurrent refresh attempts that trigger token-reuse detection.
   */
  async safeRefresh(): Promise<void> {
    if (this.isRefreshing) return; // refresh already in progress, skip
    this.isRefreshing = true;
    try {
      const success = await this.refreshAccessToken();
      if (success) {
        this.processPendingRequests(null);
      } else {
        const error = new ApiError(401, { code: 'REFRESH_FAILED', message: 'Sesión expirada.' });
        this.processPendingRequests(error);
        throw error;
      }
    } finally {
      this.isRefreshing = false;
    }
  }

  async get<T>(endpoint: string, config?: RequestConfig): Promise<T> {
    return this.request<T>(endpoint, { ...config, method: 'GET' });
  }

  async post<T>(endpoint: string, body?: unknown, config?: RequestConfig): Promise<T> {
    return this.request<T>(endpoint, {
      ...config,
      method: 'POST',
      body: body ? JSON.stringify(body) : undefined,
    });
  }

  async put<T>(endpoint: string, body?: unknown, config?: RequestConfig): Promise<T> {
    return this.request<T>(endpoint, {
      ...config,
      method: 'PUT',
      body: body ? JSON.stringify(body) : undefined,
    });
  }

  async delete<T>(endpoint: string, config?: RequestConfig): Promise<T> {
    return this.request<T>(endpoint, { ...config, method: 'DELETE' });
  }

  async patch<T>(endpoint: string, body?: unknown, config?: RequestConfig): Promise<T> {
    return this.request<T>(endpoint, {
      ...config,
      method: 'PATCH',
      body: body ? JSON.stringify(body) : undefined,
    });
  }
}

export const apiClient = new ApiClient();
