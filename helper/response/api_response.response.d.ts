import { ERROR_TYPE } from '../types/errors.type';
export type APIResponse<T> =
  | {
      data: {
        [key: string]: T;
      };
      error?: undefined;
    }
  | {
      data?: undefined;
      error: ErrorResponse;
    };
export interface ErrorResponse {
  code?: string;
  error?: ERROR_TYPE;
  message: string;
  details?: unknown;
}
