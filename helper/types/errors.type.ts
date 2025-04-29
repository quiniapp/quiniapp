export enum ERROR_TYPE {
  NOT_FOUND,
  USER_NOT_FOUND,
  BAD_REQUEST,
  INVALID_CREDENTIALS,
  INTERNAL_SERVER_ERROR,
  AUTH_ERROR,
  USERNAME_IS_REQUIRED
}

export const ERROR_MESSAGE={
  NOT_FOUND: 'No se encontro',
  USER_NOT_FOUND: "Usuario no entontrado",
  BAD_REQUEST: "Hubo un error al procesar la solicitud",
  INTERNAL_SERVER_ERROR: "Error en el servidor",
  INVALID_CREDENTIALS: "Usuario o contraseña incorrectos",
  USERNAME_IS_REQUIRED: "El nombre de usuario es requerido",
  
}