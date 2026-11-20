import { POLLA_EDITION_STATUS } from '@helper/polla/types/game.type';

/** Los pixeles que faltan para el final de la lista a partir de los cuales se trae la página siguiente. */
const LOAD_MORE_THRESHOLD = 24;

/** El scroll del desplegable llegó (casi) al final: hay que traer la página siguiente. */
export const shouldLoadMore = (
  el: { scrollTop: number; clientHeight: number; scrollHeight: number },
  threshold = LOAD_MORE_THRESHOLD
): boolean => el.scrollHeight - el.scrollTop - el.clientHeight <= threshold;

/**
 * Edición con la que abre la pantalla: la primera activa de lo cargado (la
 * API las trae de la más nueva a la más vieja) o, si no hay, la primera.
 */
export const preferredEdition = <T extends { status: POLLA_EDITION_STATUS }>(
  editions: T[]
): T | undefined => editions.find((e) => e.status === POLLA_EDITION_STATUS.ACTIVE) ?? editions[0];

/**
 * Los ids que no se conocen todavía, sin repetir y ordenados (para una query
 * key estable): son los que hay que pedir por id.
 */
export const missingIds = (ids: string[], isKnown: (id: string) => boolean): string[] =>
  [...new Set(ids)].filter((id) => !isKnown(id)).sort();

/** Une las páginas sin repetir ids (si se crea una edición mientras se pagina con OFFSET, el borde se corre). */
export const uniqueById = <T>(items: T[], idOf: (t: T) => string): T[] => {
  const seen = new Set<string>();
  return items.filter((item) => {
    const id = idOf(item);
    if (seen.has(id)) return false;
    seen.add(id);
    return true;
  });
};
