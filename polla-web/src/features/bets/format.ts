import dayjs from 'dayjs';
import { IPollaBetListItem, IPollaEditionEntityFront } from '@helper/polla/types/game.type';

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

export const cashierLabel = (row: IPollaBetListItem) =>
  `${row.cashier_number ? `${row.cashier_number} · ` : ''}${row.cashier_name}`;
