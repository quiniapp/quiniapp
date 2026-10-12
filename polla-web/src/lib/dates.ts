import dayjs from 'dayjs';

/** Hoy (`YYYY-MM-DD`) según el reloj del navegador, para usar como `max` de una fecha. */
export const todayIso = () => dayjs().format('YYYY-MM-DD');
