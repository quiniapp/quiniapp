import { ApiError } from '@/lib/apiClient';

/** Sin respuesta del servidor (sin conexión, caído o cortado a mitad). */
export const NETWORK_ERROR_MESSAGE = 'No se pudo conectar con el servidor. Revisá la conexión.';

/**
 * El aviso que se muestra cuando falla una consulta, o `null` si no hay que
 * avisar: la sesión vencida (401) ya la maneja el `apiClient`, que manda al
 * login.
 */
export const queryErrorMessage = (error: unknown): string | null => {
  if (error instanceof ApiError) {
    if (error.statusCode === 401) return null;
    return error.message || 'No se pudo cargar la información';
  }
  return NETWORK_ERROR_MESSAGE;
};
