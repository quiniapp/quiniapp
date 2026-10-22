import {
  IPollaUserEntityFront,
  IPollaUserOption,
  POLLA_USER_TYPE,
} from '@helper/polla/types/user.type';

export const pollaUserFullName = (user: IPollaUserOption) =>
  `${user.name} ${user.last_name ?? ''}`.trim();

/** "pasador" / "jugador de 3 · Pedro" (solo "jugador" sin el pasador a mano). */
const roleText = (user: IPollaUserOption) => {
  if (user.user_type !== POLLA_USER_TYPE.PLAYER) return 'pasador';
  if (!user.cashier_name) return 'jugador';
  return `jugador de ${user.cashier_number ? `${user.cashier_number} · ` : ''}${user.cashier_name}`;
};

/** "Juan Pérez · pasador" / "Ana Gómez · jugador de 3 · Pedro". */
export const describePollaUser = (user: IPollaUserOption) =>
  `${pollaUserFullName(user)} · ${roleText(user)}`;

/** Segunda línea de cada fila del buscador: el tipo y el usuario. */
export const pollaUserTypeLine = (user: IPollaUserOption) =>
  user.username ? `${roleText(user)} · ${user.username}` : roleText(user);

/**
 * Un usuario traído por id (p. ej. el filtro que quedó en la URL) como opción
 * del buscador. Para un jugador, `cashier` es su pasador; mientras no llegue,
 * la opción dice solo "jugador".
 */
export const pollaUserOption = (
  user: IPollaUserEntityFront,
  cashier?: IPollaUserEntityFront | null
): IPollaUserOption => {
  const owner = user.user_type === POLLA_USER_TYPE.PLAYER ? cashier : user;
  return {
    polla_user_id: user.polla_user_id,
    name: user.name,
    last_name: user.last_name,
    username: user.username,
    number: user.number ?? 0,
    user_type: user.user_type,
    cashier_name: owner?.name ?? '',
    cashier_number: owner?.number ?? null,
  };
};
