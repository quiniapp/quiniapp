import dayjs from 'dayjs';

/**
 * Nombres de los partes diarios (pedido del cliente, 17/11/2026): siempre con
 * fecha. "Polla semanal" es la edición regular; "Polla plus", la especial; sin
 * edición (historial por días, varias ediciones) queda "Polla".
 */

const fmt = (date: string) => dayjs(date).format('DD-MM-YYYY');

/** Sin los caracteres que no admite un nombre de archivo y con un solo espacio entre palabras. */
const cleanFileText = (text: string) =>
  text
    .replace(/[\\/:*?"<>|]/g, '_')
    .replace(/\s+/g, ' ')
    .trim();

export interface DailyReportNameParams {
  /** `true` especial, `false` regular, sin valor cuando no hay una edición. */
  special?: boolean;
  /** `YYYY-MM-DD`: la liquidación o el día; con `to`, el inicio del rango. */
  date: string;
  /** `YYYY-MM-DD`: fin del rango. */
  to?: string;
  /** El grupo filtrado (`Grupo 2 - Centro`, `Sin grupo`). */
  group?: string;
  /** Parte diario de grupos. */
  groups?: boolean;
}

/**
 * `Polla semanal parte diario 15-11-2026`, `Polla plus parte diario Grupo 2 -
 * Centro 15-11-2026`, `Polla parte diario 01-11-2026 al 15-11-2026`, `Polla
 * semanal parte diario grupos 15-11-2026`.
 */
export const pollaDailyReportName = ({
  special,
  date,
  to,
  group,
  groups,
}: DailyReportNameParams) => {
  const product = special === undefined ? 'Polla' : special ? 'Polla plus' : 'Polla semanal';
  const dates = to && to !== date ? `${fmt(date)} al ${fmt(to)}` : fmt(date);
  return cleanFileText(
    [product, 'parte diario', groups ? 'grupos' : '', group ?? '', dates].filter(Boolean).join(' ')
  );
};

/** Etiqueta del grupo filtrado para el nombre: `Grupo N - Nombre` o solo el nombre. */
export const groupFileLabel = (group?: { number?: number | null; name: string } | null) =>
  group ? (group.number ? `Grupo ${group.number} - ${group.name}` : group.name) : undefined;
