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
  POLLA_EDITION_HAS_WINNERS: () =>
    new ForbiddenError('La edición ya tiene ganadores: no se puede eliminar'),
  POLLA_LOAD_LIMIT_EXCEEDED: () => new ForbiddenError('Cerró la carga de esta edición'),
  POLLA_BET_NOT_FOUND: () => new NotFoundError('Jugada de Polla'),
  POLLA_BET_ALREADY_WINNER: () =>
    new ForbiddenError('La jugada ya es ganadora, no se puede modificar'),
  POLLA_BET_DELETE_ONLY_SAME_DAY: () =>
    new ForbiddenError('Solo se pueden eliminar las jugadas cargadas hoy'),
  POLLA_BET_DELETE_LIQUIDATED: () =>
    new ForbiddenError(
      'Tu cuenta ya se liquidó desde el día de carga de este ticket: solo un administrador puede borrarlo'
    ),
  POLLA_NUMBERS_MUST_BE_TEN: () => new BadRequestError('La jugada debe tener 10 números'),
  POLLA_NUMBERS_INVALID: () => new BadRequestError('Los números deben ser de 2 cifras (00-99)'),
  POLLA_RESULTS_INVALID: () => new BadRequestError('Los resultados deben ser de 2 cifras (00-99)'),
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
  POLLA_TICKET_NUMBER_COLLISION: () =>
    new ConflictError('No se pudo generar un número de ticket, reintentá'),
  POLLA_CURRENT_ACCOUNT_NOT_FOUND: () => new NotFoundError('Cuenta corriente'),
  POLLA_USER_OTHER_GROUP: () => new ForbiddenError('El usuario o la jugada es de otro grupo'),
  POLLA_PARENT_OTHER_GROUP: () =>
    new BadRequestError('El jugador solo puede pasar a otro pasador de su mismo grupo'),
  POLLA_USER_GROUP_LOCKED: () =>
    new BadRequestError('El grupo de un pasador no se cambia: se fija al crearlo'),
  POLLA_BET_TARGET_FORBIDDEN: () =>
    new ForbiddenError('Solo podés cargar a tu nombre o al de tus jugadores'),
  POLLA_BET_WRITE_FORBIDDEN: () => new ForbiddenError('No podés modificar esta jugada'),
  POLLA_BET_OUT_OF_SCOPE: () => new ForbiddenError('El ticket no está dentro de tu alcance'),
  POLLA_FREE_BET_FORBIDDEN: () =>
    new ForbiddenError('Solo un administrador puede repetir tickets sin cargo'),
  POLLA_SOURCE_EDITION_NOT_FINISHED: () =>
    new BadRequestError('Solo se repiten sin cargo tickets de ediciones finalizadas'),
  POLLA_LOAD_LIMIT_AFTER_FIRST_DRAW: () =>
    new BadRequestError('El cierre de carga tiene que ser antes del primer sorteo'),
  POLLA_EDITION_HAS_WINNERS_LOCKED: () =>
    new ForbiddenError('La edición ya tiene ganadores: solo se puede cambiar el nombre'),
  POLLA_EDITION_DRAWS_LOCKED: () =>
    new BadRequestError(
      'La edición ya tiene sorteos cargados: no se cambian quiniela, turno ni fecha de inicio'
    ),
  POLLA_EDITION_END_BEFORE_DRAW: () =>
    new BadRequestError('La fecha de fin no puede ser anterior al último sorteo cargado'),
  POLLA_EDITION_EXTEND_AFTER_FREE_REPEAT: () =>
    new ForbiddenError('Ya se repitieron tickets sin cargo desde esta edición: no se extiende'),
  POLLA_GROUP_NOT_FOUND: () => new NotFoundError('Grupo'),
  POLLA_GROUP_HAS_ACTIVE_BETS: () =>
    new ForbiddenError('El grupo tiene jugadas en ediciones en juego: no se puede borrar'),
  POLLA_GROUP_CASHIERS_PENDING: () =>
    new ForbiddenError('Hay pasadores del grupo sin liquidar a esa fecha'),
  POLLA_GROUP_ACCOUNT_OPEN: () =>
    new ForbiddenError('El grupo tiene un período sin liquidar: liquidalo antes de borrarlo'),
  POLLA_GROUP_ACCOUNT_LATER_EXISTS: () =>
    new BadRequestError('El grupo ya tiene una liquidación posterior a esa fecha'),
  POLLA_GROUP_PERCENTAGE_INVALID: () =>
    new BadRequestError('El porcentaje del admin tiene que estar entre 0 y 100'),
  unique_polla_group_admin_active: () => new ConflictError('Ese grupo ya tiene un admin'),
  no_overlapping_polla_editions: () =>
    new ConflictError('Ya hay una edición para esa quiniela y turno en ese rango de fechas'),
  unique_polla_username_active: () => new ConflictError('Ese nombre de usuario ya está en uso'),
  unique_polla_cashier_number_active: () =>
    new ConflictError('Ese número de pasador ya está en uso en el grupo'),
  unique_polla_player_number_active: () =>
    new ConflictError('Ese número de jugador ya está en uso en el pasador'),
  unique_polla_group_number_active: () => new ConflictError('Ya existe un grupo con ese número'),
  polla_users_street_check: () =>
    new BadRequestError('Solo pasadores y jugadores son de calle, y sin usuario ni contraseña'),
  polla_bets_identifier_length: () => new BadRequestError('El identificador tiene hasta 60 letras'),
  POLLA_BET_IDENTIFIER_REQUIRED: () =>
    new BadRequestError('Poné el identificador del ticket o cargalo a nombre de un jugador'),
  unique_polla_organization_name_active: () =>
    new ConflictError('Ya existe una organización con ese nombre'),
  unique_polla_group_name_active: () => new ConflictError('Ya existe un grupo con ese nombre'),
  unique_polla_lottery_name_active: () =>
    new ConflictError('Ya existe una quiniela con ese nombre'),
  unique_polla_schedule_name_active: () => new ConflictError('Ya existe un turno con ese nombre'),
  unique_polla_result_active: () => new ConflictError('Ya hay resultados cargados para ese día'),
  polla_users_role_fields_check: () =>
    new BadRequestError('Los datos no corresponden al tipo de usuario'),
  polla_users_number_required: () =>
    new BadRequestError('Pasadores y jugadores necesitan un número'),
};

/**
 * Traduce un error de Supabase/Postgres a un AppError. Todo lo que no
 * reconocemos sube como DatabaseError y el errorHandler lo loguea completo.
 */
export const mapPollaError = (error: { message?: string; code?: string } | null): AppError => {
  const message = error?.message ?? '';

  // Gana el código más largo: `POLLA_EDITION_HAS_WINNERS` es prefijo de
  // `POLLA_EDITION_HAS_WINNERS_LOCKED`.
  const key = Object.keys(SQL_ERROR_MAP)
    .filter((code) => message.includes(code))
    .sort((a, b) => b.length - a.length)[0];
  if (key) return SQL_ERROR_MAP[key]();

  return new DatabaseError(message || 'Error de base de datos en Polla');
};

/** Lanza el AppError correspondiente si la respuesta de Supabase trae error. */
export const throwIfPollaError = (error: { message?: string; code?: string } | null): void => {
  if (error) throw mapPollaError(error);
};
