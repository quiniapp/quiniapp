export type ReportMode = 'day' | 'range';

/** Valor del select de grupo para "todos los grupos". */
export const ALL_GROUPS = '__all__';

export const fmtMoney = (value: number | null | undefined) =>
  new Intl.NumberFormat('es-AR', { minimumFractionDigits: 2 }).format(Number(value ?? 0));
