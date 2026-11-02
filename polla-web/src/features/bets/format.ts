import dayjs from 'dayjs';
import { IPollaBetListItem, IPollaEditionEntityFront } from '@helper/polla/types/game.type';
import { pollaCashierCode } from '@helper/polla/types/user.type';

export const fmtDate = (value?: string | null) => (value ? dayjs(value).format('DD-MM-YYYY') : '-');

export const fmtMoney = (value: number) =>
  new Intl.NumberFormat('es-AR', { minimumFractionDigits: 2 }).format(Number(value));

export const editionLabel = (
  edition: IPollaEditionEntityFront,
  lotteryName?: string,
  scheduleName?: string
) =>
  `${lotteryName ?? 'Quiniela'} · ${scheduleName ?? 'Turno'} (${fmtDate(edition.start_date)} al ${fmtDate(
    edition.end_date
  )})`;

/** `2-5 · Pedro`: el número de pasador se repite entre grupos. */
export const cashierLabel = (row: IPollaBetListItem) => {
  const code = pollaCashierCode(row.group_number, row.cashier_number);
  return `${code ? `${code} · ` : ''}${row.cashier_name}`;
};

/** Jugador y/o identificador del ticket ("Ana · chicho"); vacío si no tiene ninguno. */
export const clientLabel = (row: IPollaBetListItem) =>
  [row.client_name, row.identifier].filter(Boolean).join(' · ');
