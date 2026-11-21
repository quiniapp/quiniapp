export type ReportMode = 'day' | 'range';

/** Valor del select de grupo para "todos los grupos". */
export const ALL_GROUPS = '__all__';

export const fmtMoney = (value: number | null | undefined) =>
  new Intl.NumberFormat('es-AR', { minimumFractionDigits: 2 }).format(Number(value ?? 0));

/**
 * Un Debe en una celda bajo la columna "Debe": `$100,00`, o `Cobra $30,00` si
 * es negativo (le deben al grupo). Cero es `$0,00`.
 */
export const fmtOwed = (owed: number) =>
  owed < 0 ? `Cobra $${fmtMoney(Math.abs(owed))}` : `$${fmtMoney(owed)}`;

/**
 * El Debe de una edición en la lista, sin compensar: "Debe $100,00 · Cobra
 * $30,00" (lo que deben los pasadores y lo que hay que pagarles). La parte en
 * 0 no se muestra; con las dos en 0, "Debe $0,00".
 */
export const owedSummary = (owedByCashiers: number | string, owedToCashiers: number | string) => {
  const by = Number(owedByCashiers);
  const to = Number(owedToCashiers);
  const parts = [by !== 0 && `Debe $${fmtMoney(by)}`, to !== 0 && `Cobra $${fmtMoney(to)}`];
  const shown = parts.filter((part): part is string => Boolean(part));
  return shown.length > 0 ? shown.join(' · ') : `Debe $${fmtMoney(0)}`;
};
