import { Buffer } from 'node:buffer';
import { BadRequestError } from '@helper/errors';

/**
 * Cursores de paginación keyset (ver CLAUDE.md, "SQL Performance").
 *
 * El cursor es la posición de la última fila de la página anterior (los valores
 * de las columnas del ORDER BY, con el desempate único al final), opaco para el
 * cliente: base64url de las partes unidas con `|`.
 *
 * Lo manda el cliente y sus partes se interpolan en un filtro `or=` de
 * PostgREST, que es un mini-lenguaje con comas y paréntesis: sin validar se
 * podrían inyectar cláusulas extra. Cada parte se valida contra una expresión
 * que no admite ningún carácter con significado en ese lenguaje.
 *
 * Los timestamps viajan como el string crudo que devuelve la base (con
 * microsegundos): pasarlos por `Date` los trunca a milisegundos y el cursor
 * saltearía o repetiría filas.
 */

/** Timestamp ISO tal como lo devuelve PostgREST (`2026-11-16T18:38:05.123456+00:00`). */
export const CURSOR_TIMESTAMP =
  /^\d{4}-\d{2}-\d{2}[T ]\d{2}:\d{2}:\d{2}(\.\d{1,6})?([+-]\d{2}:?\d{2}|Z)?$/;

export const CURSOR_UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Entero no negativo (p. ej. `bet_order`). */
export const CURSOR_INT = /^\d{1,9}$/;

/**
 * Tope de filas por página. PostgREST corta cada respuesta en `max_rows` (1000)
 * y el keyset pide `limit + 1` para saber si hay más.
 */
export const MAX_PAGE_SIZE = 900;

/** `limit` de la query string: entero ≥ 1, con tope `MAX_PAGE_SIZE`; si no, `fallback`. */
export const parsePageSize = (value: unknown, fallback: number): number => {
  const n = typeof value === 'string' ? parseInt(value, 10) : NaN;
  return Number.isFinite(n) && n >= 1 ? Math.min(n, MAX_PAGE_SIZE) : fallback;
};

/** `page` de la query string (paginación por offset): entero ≥ 1; si no, 1. */
export const parsePageNumber = (value: unknown): number => {
  const n = typeof value === 'string' ? parseInt(value, 10) : NaN;
  return Number.isFinite(n) && n >= 1 ? n : 1;
};

/**
 * Corta la fila extra que se pidió para saber si hay más (`limit + 1`) y arma
 * el cursor de la página siguiente con la última fila que se devuelve.
 */
export const keysetPage = <T>(
  rows: T[],
  limit: number,
  // eslint-disable-next-line no-unused-vars
  cursorOf: (row: T) => ReadonlyArray<string | number>
): { data: T[]; hasMore: boolean; next_cursor: string | null } => {
  const hasMore = rows.length > limit;
  const data = hasMore ? rows.slice(0, limit) : rows;
  const last = data[data.length - 1];
  return {
    data,
    hasMore,
    next_cursor: hasMore && last ? encodeCursor(cursorOf(last)) : null,
  };
};

export const encodeCursor = (parts: ReadonlyArray<string | number>): string =>
  Buffer.from(parts.join('|')).toString('base64url');

/**
 * Decodifica un cursor y valida cada parte contra `validators` (uno por parte,
 * en orden). Un cursor que no cumple responde 400.
 */
export const decodeCursor = (cursor: string, validators: ReadonlyArray<RegExp>): string[] => {
  const decoded = Buffer.from(cursor, 'base64url').toString('utf8');
  const parts = decoded.split('|');

  if (parts.length !== validators.length || !parts.every((part, i) => validators[i].test(part))) {
    throw new BadRequestError('Cursor inválido');
  }

  return parts;
};
