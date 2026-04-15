/**
 * Calcula el premio esperado para un tipo de jugada
 */
export function calculateExpectedPrize(
  betType: string,
  place: string,
  position: string | null,
  hits: number,
  amount: number
): number {
  const multipliers: Record<string, any> = {
    ONE: { HEAD: 7 },
    DOUBLE: { HEAD: 70, FIVE: 14, TEN: 7, TWENTY: 3.5 },
    TERN: { HEAD: 600, FIVE: 120, TEN: 60, TWENTY: 30 },
    QUATERN: { HEAD: 3500, FIVE: 700, TEN: 350, TWENTY: 175 },
    BORRATINA: {
      5: 1200,
      4: 80,
      3: 8,
    },
    REDOUBLE: {
      'HEAD-FIVE': 1280,
      'HEAD-TEN': 640,
      'HEAD-TWENTY': 336,
      'FIVE-FIVE': 256,
      'FIVE-TEN': 128,
      'FIVE-TWENTY': 64,
      'TEN-TEN': 64,
      'TEN-TWENTY': 32,
      'TWENTY-TWENTY': 16,
    },
  };

  if (betType === 'BORRATINA') {
    return (multipliers.BORRATINA[hits] || 0) * amount;
  }

  if (betType === 'REDOUBLE' && position) {
    const key = `${place}-${position}`;
    return multipliers.REDOUBLE[key] * hits * amount;
  }

  const mult = multipliers[betType]?.[place] || 0;
  return mult * hits * amount;
}

/**
 * Calcula el revenue esperado para un día
 */
export function calculateExpectedRevenue(
  totalPass: number,
  totalPrize: number,
  fee: number
): number {
  const commission = totalPass * (fee / 100);
  return totalPass - commission - totalPrize;
}

/**
 * Calcula el drag esperado
 */
export function calculateExpectedDrag(
  previousDrag: number,
  revenue: number,
  feePlus: number
): number {
  if (feePlus <= 0) return 0;
  return previousDrag + revenue;
}

/**
 * Calcula el leave esperado
 */
export function calculateExpectedLeave(
  drag: number,
  feePlus: number,
  calculateLeave: boolean
): number {
  if (feePlus <= 0 || !calculateLeave || drag <= 0) return 0;
  return Math.round(drag * (feePlus / 100) * 100) / 100;
}

/**
 * Calcula el total esperado de current account
 */
export function calculateExpectedTotal(
  previousBalance: number,
  revenue: number,
  collections: number,
  paid: number,
  leave: number
): number {
  return previousBalance + revenue - collections + paid - leave;
}
