// ⚠️ DEPRECATED - Usar AppError classes de @helper/errors en su lugar
// Mantener temporalmente para compatibilidad durante migración
/**
 * @deprecated Usar AppError classes en vez de ERROR_TYPE
 */
export enum ERROR_TYPE {
  NOT_FOUND,
  USER_NOT_FOUND,
  BAD_REQUEST,
  INVALID_CREDENTIALS,
  INTERNAL_SERVER_ERROR,
  AUTH_ERROR,
  USERNAME_IS_REQUIRED,
  PASSWORD_IS_REQUIRED,
  NAME_IS_REQUIRED,
  CASHIER_NUMBER_IS_REQUIRED,
  FORBIDDEN,
  TOKEN_ERROR,
  NEW_USER_REQUIRED,
  ID_REQUIRED,
  INVALID_ID,
}

/**
 * @deprecated Usar AppError classes en vez de ERROR_MESSAGE
 */
export const ERROR_MESSAGE = {
  NOT_FOUND: 'No se encontro',
  USER_NOT_FOUND: 'Usuario no entontrado',
  BAD_REQUEST: 'Hubo un error al procesar la solicitud',
  INTERNAL_SERVER_ERROR: 'Error en el servidor',
  INVALID_CREDENTIALS: 'Usuario o contraseña incorrectos',
  USERNAME_IS_REQUIRED: 'El nombre de usuario es requerido',
  PASSWORD_IS_REQUIRED: 'La contraseña es requerida',
  NAME_IS_REQUIRED: 'El nombre es requerido',
  CASHIER_NUMBER_IS_REQUIRED: 'El número de cajero es requerido',
  FORBIDDEN: 'Esa acción no se puede realizar',
  TOKEN_ERROR: 'Token inválido o incompleto',

  AUTH_ERROR: 'Ocurrió un error al crear el usuario',
  NEW_USER_REQUIRED: 'El nuevo ususario es requerido',
  ID_REQUIRED: 'El ID es requerido',
  INVALID_ID: 'El ID no es válido',

  INVALID_DELETE_TIME: 'Pasaron más de 2 minutos desde la creación',
  TICKET_NOT_FOUND: 'Ticket no encontrado',
  TICKET_NOT_OWNED: 'El ticket no pertenece al usuario',
  TICKET_ALREADY_PAID: 'El ticket ya fue pagado',
  TICKET_NOT_WINNER: 'El ticket no es ganador',
  INVALID_USER_ID: 'ID de usuario inválido',
};

// ✅ NUEVO - Error codes estandarizados
export const ERROR_CODES = {
  // 400 - Bad Request
  BAD_REQUEST: 'BAD_REQUEST',
  VALIDATION_ERROR: 'VALIDATION_ERROR',
  INVALID_ID: 'INVALID_ID',

  // 401 - Unauthorized
  UNAUTHORIZED: 'UNAUTHORIZED',
  INVALID_CREDENTIALS: 'INVALID_CREDENTIALS',
  TOKEN_ERROR: 'TOKEN_ERROR',

  // 403 - Forbidden
  FORBIDDEN: 'FORBIDDEN',
  TICKET_NOT_OWNED: 'TICKET_NOT_OWNED',

  // 404 - Not Found
  NOT_FOUND: 'NOT_FOUND',
  USER_NOT_FOUND: 'USER_NOT_FOUND',
  TICKET_NOT_FOUND: 'TICKET_NOT_FOUND',
  LOTTERY_NOT_FOUND: 'LOTTERY_NOT_FOUND',

  // 409 - Conflict
  CONFLICT: 'CONFLICT',
  TICKET_ALREADY_PAID: 'TICKET_ALREADY_PAID',

  // 422 - Unprocessable Entity
  INVALID_DELETE_TIME: 'INVALID_DELETE_TIME',
  TICKET_NOT_WINNER: 'TICKET_NOT_WINNER',

  // 500 - Internal Server Error
  INTERNAL_SERVER_ERROR: 'INTERNAL_SERVER_ERROR',
  DATABASE_ERROR: 'DATABASE_ERROR',
} as const;

export type ErrorCode = (typeof ERROR_CODES)[keyof typeof ERROR_CODES];
