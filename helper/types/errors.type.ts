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
};
