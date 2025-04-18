import { ERROR_TYPE } from '../types/errors.type';

export type APIResponse<T> =
  | { data: T; error?: undefined }
  | { data?: undefined; error: ErrorResponse };

export interface ErrorResponse {
  error: ERROR_TYPE; // o un enum si querés definir tipos específicos de error
  message: string;
  details?: unknown; // opcional, por si querés agregar más info
}
