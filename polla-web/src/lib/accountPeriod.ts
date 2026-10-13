import dayjs from 'dayjs';
import { POLLA_ACCOUNT_RECALC_MAX_DAYS } from '@helper/polla/config/session.config';
import {
  IPollaCurrentAccountEntityFront,
  IPollaCurrentAccountPeriodRow,
} from '@helper/polla/types/game.type';

/**
 * La cuenta corriente se liquida por período (en general, la semana): la fila
 * de un día trae los montos de ese día y, en `period`, lo acumulado desde el
 * día siguiente a la última liquidación del pasador.
 */

/** Fila con los montos del período en lugar de los del día. */
export type AccountPeriodView = IPollaCurrentAccountEntityFront & {
  /** Primer día del período (YYYY-MM-DD). */
  period_from: string;
};

/** Lo que se muestra y se imprime: los montos acumulados del período. */
export const periodView = ({
  period,
  ...row
}: IPollaCurrentAccountPeriodRow): AccountPeriodView => {
  const { from, ...amounts } = period;
  return { ...row, ...amounts, period_from: from };
};

/** "06/10 al 12/10", o solo "12/10" si el período es de un día. */
export const periodLabel = (from: string, to: string, format = 'DD/MM') =>
  from === to
    ? dayjs(to).format(format)
    : `${dayjs(from).format(format)} al ${dayjs(to).format(format)}`;

/**
 * Inicio para pedir las jugadas de un período: la API acepta rangos de hasta
 * `POLLA_ACCOUNT_RECALC_MAX_DAYS` días (un pasador que nunca se liquidó puede
 * tener un período más largo).
 */
export const betsRangeFrom = (from: string, to: string) => {
  const limit = dayjs(to).subtract(POLLA_ACCOUNT_RECALC_MAX_DAYS, 'day').format('YYYY-MM-DD');
  return from < limit ? limit : from;
};
