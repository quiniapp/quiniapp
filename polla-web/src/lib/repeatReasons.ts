/**
 * Por qué no se repitió un ticket (`skipped[].reason` de `POST /bet/repeat` y
 * `/bet/free-repeat`): la base devuelve el código del error.
 */
const REPEAT_REASON_LABEL: Record<string, string> = {
  POLLA_BET_NOT_FOUND: 'el ticket no existe o está borrado',
  POLLA_BET_OUT_OF_SCOPE: 'no está dentro de tu alcance',
  POLLA_SOURCE_EDITION_NOT_FINISHED: 'su edición todavía no terminó',
  POLLA_USER_NOT_FOUND: 'el usuario está deshabilitado o borrado',
  POLLA_PARENT_NOT_FOUND: 'el jugador ya no tiene pasador',
  POLLA_USER_OTHER_GROUP: 'el usuario ya no está en tu grupo',
  POLLA_BET_TARGET_FORBIDDEN: 'el jugador ya no es tuyo',
  POLLA_LOAD_LIMIT_EXCEEDED: 'cerró la carga de la edición',
  POLLA_EDITION_NOT_ACTIVE: 'la edición no está activa',
};

export const repeatReasonLabel = (reason: string): string => {
  const code = Object.keys(REPEAT_REASON_LABEL).find((key) => reason.includes(key));
  return code ? REPEAT_REASON_LABEL[code] : reason;
};
