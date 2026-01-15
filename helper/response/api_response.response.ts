import { ERROR_TYPE } from '../types/errors.type';

export type APIResponse<T> =
  | {
      data: {
        [key: string]: T;
      };
      error?: undefined;
    }
  | { data?: undefined; error: ErrorResponse };

export interface ErrorResponse {
  // TEMPORALMENTE acepta ambos formatos durante la migración
  code?: string; // ✅ NUEVO - Código de error estandarizado (ej: 'VALIDATION_ERROR', 'NOT_FOUND')
  error?: ERROR_TYPE; // ⚠️ DEPRECATED - Mantener temporalmente para compatibilidad
  message: string; // Mensaje descriptivo del error
  details?: unknown; // Información adicional (validaciones Zod, stack traces en dev, etc.)
}
