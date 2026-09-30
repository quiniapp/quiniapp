import {
  AppError,
  BadRequestError,
  ConflictError,
  DatabaseError,
  ForbiddenError,
  NotFoundError,
} from '@helper/errors';

/** Códigos que lanzan las funciones PL/pgSQL de Polla. */
const SQL_ERROR_MAP: Record<string, () => AppError> = {
  POLLA_EDITION_NOT_FOUND: () => new NotFoundError('Edición de Polla'),
  POLLA_EDITION_NOT_ACTIVE: () => new BadRequestError('La edición de Polla no está activa'),
  POLLA_LOAD_LIMIT_EXCEEDED: () =>
    new ForbiddenError('Pasó la fecha límite de carga para esta edición'),
  POLLA_BET_NOT_FOUND: () => new NotFoundError('Jugada de Polla'),
  POLLA_BET_ALREADY_WINNER: () =>
    new ForbiddenError('La jugada ya es ganadora, no se puede modificar'),
  POLLA_NUMBERS_MUST_BE_TEN: () => new BadRequestError('La jugada debe tener 10 números'),
  POLLA_NUMBERS_NOT_DISTINCT: () => new BadRequestError('Los 10 números deben ser distintos'),
  POLLA_NUMBERS_INVALID: () => new BadRequestError('Los números deben ser de 2 cifras (00-99)'),
  POLLA_USER_NOT_FOUND: () => new NotFoundError('Usuario de Polla'),
  POLLA_USER_NOT_PLAYER: () => new BadRequestError('El usuario no es un jugador'),
  POLLA_USER_CANNOT_BET: () => new ForbiddenError('Este tipo de usuario no puede cargar jugadas'),
  POLLA_USER_OTHER_ORGANIZATION: () =>
    new ForbiddenError('El usuario pertenece a otra organización'),
  POLLA_PARENT_NOT_FOUND: () => new NotFoundError('Pasador del jugador'),
  POLLA_PARENT_NOT_CASHIER: () => new BadRequestError('El padre de un jugador debe ser un pasador'),
  POLLA_PARENT_OTHER_ORGANIZATION: () =>
    new BadRequestError('El pasador pertenece a otra organización'),
  POLLA_GROUP_OTHER_ORGANIZATION: () =>
    new BadRequestError('El grupo pertenece a otra organización'),
  POLLA_INSUFFICIENT_CREDITS: () => new BadRequestError('El jugador no tiene créditos suficientes'),
  POLLA_CREDIT_AMOUNT_ZERO: () => new BadRequestError('El monto no puede ser cero'),
  POLLA_CREDIT_SIGN_MISMATCH: () =>
    new BadRequestError('El signo del monto no corresponde al tipo'),
  POLLA_TICKET_NUMBER_COLLISION: () =>
    new ConflictError('No se pudo generar un número de ticket, reintentá'),
  POLLA_CURRENT_ACCOUNT_NOT_FOUND: () => new NotFoundError('Cuenta corriente'),
  no_overlapping_polla_editions: () =>
    new ConflictError('Ya hay una edición para esa quiniela y turno en ese rango de fechas'),
  unique_polla_username_active: () => new ConflictError('Ese nombre de usuario ya está en uso'),
  unique_polla_user_number_active: () => new ConflictError('Ese número de pasador ya está en uso'),
  unique_polla_organization_name_active: () =>
    new ConflictError('Ya existe una organización con ese nombre'),
  unique_polla_group_name_active: () => new ConflictError('Ya existe un grupo con ese nombre'),
  unique_polla_lottery_name_active: () =>
    new ConflictError('Ya existe una quiniela con ese nombre'),
  unique_polla_schedule_name_active: () => new ConflictError('Ya existe un turno con ese nombre'),
  unique_polla_result_active: () => new ConflictError('Ya hay resultados cargados para ese día'),
  polla_users_role_fields_check: () =>
    new BadRequestError('Los datos no corresponden al tipo de usuario'),
  polla_users_credit_not_negative: () => new BadRequestError('El saldo no puede quedar negativo'),
};

/**
 * Traduce un error de Supabase/Postgres a un AppError. Todo lo que no
 * reconocemos sube como DatabaseError y el errorHandler lo loguea completo.
 */
export const mapPollaError = (error: { message?: string; code?: string } | null): AppError => {
  const message = error?.message ?? '';

  const key = Object.keys(SQL_ERROR_MAP).find((code) => message.includes(code));
  if (key) return SQL_ERROR_MAP[key]();

  return new DatabaseError(message || 'Error de base de datos en Polla');
};

/** Lanza el AppError correspondiente si la respuesta de Supabase trae error. */
export const throwIfPollaError = (error: { message?: string; code?: string } | null): void => {
  if (error) throw mapPollaError(error);
};
