import { APIResponse, ErrorResponse } from '@helper/response/api_response.response';

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
}

class ApiClient {
  private baseURL: string;

  constructor(baseURL: string = '') {
    this.baseURL = baseURL;
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
    const { params, ...fetchConfig } = config;

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
        throw new ApiError(
          response.status,
          data.error || {
            code: 'UNKNOWN_ERROR',
            message: `La solicitud falló con estado ${response.status}`,
          }
        );
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
