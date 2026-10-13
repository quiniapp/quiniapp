import dayjs from 'dayjs';
import utc from 'dayjs/plugin/utc';
import timezone from 'dayjs/plugin/timezone';

dayjs.extend(utc);
dayjs.extend(timezone);

const POLLA_TIMEZONE = 'America/Argentina/Buenos_Aires';

/**
 * Fecha de negocio (`YYYY-MM-DD`) en Argentina. El servidor corre en UTC: con
 * `new Date()` una jugada cargada después de las 21 caía en el día siguiente.
 * Es la misma fecha que usa `polla_today()` en la base.
 */
export const pollaToday = (): string => dayjs().tz(POLLA_TIMEZONE).format('YYYY-MM-DD');

/** Hora actual (`HH:mm:ss`) en Argentina, para comparar con el cierre de carga. */
export const pollaNowTime = (): string => dayjs().tz(POLLA_TIMEZONE).format('HH:mm:ss');

/**
 * ¿Sigue abierta la carga? Mismo criterio que `polla_load_closed` en la base:
 * cierra cuando el momento actual (Argentina) pasa la fecha y hora de cierre.
 */
export const isPollaLoadOpen = (limitDate: string, limitTime: string): boolean => {
  const today = pollaToday();
  return limitDate > today || (limitDate === today && limitTime >= pollaNowTime());
};
