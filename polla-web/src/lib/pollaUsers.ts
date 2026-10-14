import {
  IPollaUserEntityFront,
  IPollaUserOption,
  POLLA_USER_TYPE,
} from '@helper/polla/types/user.type';

export const pollaUserFullName = (user: IPollaUserOption) =>
  `${user.name} ${user.last_name ?? ''}`.trim();

/** "pasador" / "jugador de 3 · Pedro". */
const roleText = (user: IPollaUserOption) =>
  user.user_type === POLLA_USER_TYPE.PLAYER
    ? `jugador de ${user.cashier_number ? `${user.cashier_number} · ` : ''}${user.cashier_name}`
    : 'pasador';

/** "Juan Pérez · pasador" / "Ana Gómez · jugador de 3 · Pedro". */
export const describePollaUser = (user: IPollaUserOption) =>
  `${pollaUserFullName(user)} · ${roleText(user)}`;

/** Segunda línea de cada fila del buscador: el tipo y el usuario. */
export const pollaUserTypeLine = (user: IPollaUserOption) =>
  user.username ? `${roleText(user)} · @${user.username}` : roleText(user);

/**
 * Un pasador traído por id (p. ej. el filtro que quedó en la URL) como opción
 * del buscador. Solo para pasadores: el de un jugador sería otro usuario.
 */
export const cashierOption = (user: IPollaUserEntityFront): IPollaUserOption => ({
  polla_user_id: user.polla_user_id,
  name: user.name,
  last_name: user.last_name,
  username: user.username,
  number: user.number ?? 0,
  user_type: user.user_type,
  cashier_name: user.name,
  cashier_number: user.number,
});
