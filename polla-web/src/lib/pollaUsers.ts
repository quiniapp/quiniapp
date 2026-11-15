import {
  IPollaUserEntityFront,
  IPollaUserOption,
  POLLA_USER_TYPE,
  pollaCashierCode,
} from '@helper/polla/types/user.type';

export const pollaUserFullName = (user: IPollaUserOption) =>
  `${user.name} ${user.last_name ?? ''}`.trim();

/**
 * Número con que se muestra en el buscador: el pasador como `{grupo}-{número}`
 * (se repite entre grupos); el jugador, su número dentro de su pasador.
 */
export const pollaUserCode = (user: IPollaUserOption) =>
  user.user_type === POLLA_USER_TYPE.CASHIER
    ? pollaCashierCode(user.group_number, user.number)
    : String(user.number);

/**
 * Por qué no puede entrar ni jugar: deshabilitado, o jugador de un pasador
 * deshabilitado. Solo aparecen así en los buscadores que filtran.
 */
export const pollaUserBlockedText = (
  user: Pick<IPollaUserOption, 'disabled' | 'cashier_disabled'>
): string | null => {
  if (user.disabled) return 'deshabilitado';
  if (user.cashier_disabled) return 'pasador deshabilitado';
  return null;
};

/** "pasador" / "jugador de 2-3 · Pedro" (solo "jugador" sin el pasador a mano). */
const roleText = (user: IPollaUserOption) => {
  const street = user.is_street ? ' de calle' : '';
  if (user.user_type !== POLLA_USER_TYPE.PLAYER) return `pasador${street}`;
  if (!user.cashier_name) return `jugador${street}`;
  const code = pollaCashierCode(user.group_number, user.cashier_number);
  return `jugador${street} de ${code ? `${code} · ` : ''}${user.cashier_name}`;
};

/** Partes de una línea, sin las vacías, con la marca de frenado al final. */
const joinWithBlocked = (user: IPollaUserOption, parts: (string | null)[]) =>
  [...parts, pollaUserBlockedText(user)].filter(Boolean).join(' · ');

/** "Juan Pérez · pasador" / "Ana Gómez · jugador de 3 · Pedro". */
export const describePollaUser = (user: IPollaUserOption) =>
  joinWithBlocked(user, [pollaUserFullName(user), roleText(user)]);

/** Segunda línea de cada fila del buscador: el tipo y el usuario. */
export const pollaUserTypeLine = (user: IPollaUserOption) =>
  joinWithBlocked(user, [roleText(user), user.username]);

/**
 * Un usuario traído por id (p. ej. el filtro que quedó en la URL) como opción
 * del buscador. Para un jugador, `cashier` es su pasador; mientras no llegue,
 * la opción dice solo "jugador".
 */
export const pollaUserOption = (
  user: IPollaUserEntityFront,
  cashier?: IPollaUserEntityFront | null,
  groupNumber: number | null = null
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
    group_number: groupNumber,
    is_street: user.is_street,
    disabled: user.disabled,
    cashier_disabled:
      user.user_type === POLLA_USER_TYPE.PLAYER ? Boolean(cashier?.disabled) : false,
  };
};
