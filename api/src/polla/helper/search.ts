/** Largo máximo de lo que se busca: alcanza para un nombre y acota la query. */
const MAX_SEARCH_LENGTH = 50;

/**
 * Patrón `ilike` listo para meter en un `.or()` de PostgREST: `"%texto%"`.
 *
 * Va entre comillas dobles para que `,`, `(`, `)` o `.` escritos por el usuario
 * no rompan ni cambien el filtro; las comillas y las barras se quitan porque
 * son lo único que escapa dentro de las comillas. `%`, `_` y `*` quedan como
 * comodines: a lo sumo traen de más. Devuelve `null` si no queda nada.
 */
export const ilikeTerm = (raw: string): string | null => {
  const text = raw.replace(/["\\]/g, '').trim().slice(0, MAX_SEARCH_LENGTH);
  return text ? `"%${text}%"` : null;
};

/** `name.ilike."%x%",last_name.ilike."%x%",…` para buscar en varias columnas. */
export const ilikeAny = (columns: string[], raw: string): string | null => {
  const term = ilikeTerm(raw);
  return term ? columns.map((column) => `${column}.ilike.${term}`).join(',') : null;
};

/** Solo dígitos es un número de usuario: se busca exacto, no como texto. */
export const searchNumber = (raw: string): number | null => {
  const text = raw.trim();
  return /^\d{1,9}$/.test(text) ? Number(text) : null;
};

/**
 * `2-5` es el pasador 5 del grupo 2 (`0-5`, el pasador 5 sin grupo): los
 * números de pasador se repiten entre grupos.
 */
export const searchCashierCode = (raw: string): { group: number; number: number } | null => {
  const match = /^(\d{1,4})-(\d{1,9})$/.exec(raw.trim());
  return match ? { group: Number(match[1]), number: Number(match[2]) } : null;
};
