import dayjs from 'dayjs';

/** Estilo de un casillero: acertado (amarillo, negrita) o pendiente (plano). */
export const betNumberClass = (hit: boolean) =>
  hit ? 'bg-hit font-bold text-hit-foreground' : 'bg-card text-card-foreground';

export const hitTitle = (hitDate: string | null | undefined) =>
  hitDate ? `Acierto del ${dayjs(hitDate).format('DD-MM')}` : undefined;
