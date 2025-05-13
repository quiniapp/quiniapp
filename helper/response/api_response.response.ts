import { ERROR_TYPE } from '../types/errors.type';

export type APIResponse<T> =
  | {
<<<<<<< Updated upstream
      data: {
        [key: string]: T;
      };
      error?: undefined;
    }
=======
  data: {
    [key: string]: T;
  };
  error?: undefined;
}
>>>>>>> Stashed changes
  | { data?: undefined; error: ErrorResponse };
export interface ErrorResponse {
  error: ERROR_TYPE;
  message: string;
  details?: unknown;
}
