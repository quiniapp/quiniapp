/**
 * Results que garantizan el máximo número de hits para cada tipo
 *
 * Máximos por tipo:
 * - ONE HEAD: 1 hit (solo posición 1)
 * - DOUBLE HEAD: 1 hit (solo posición 1)
 * - DOUBLE FIVE: 5 hits (todas las primeras 5 posiciones)
 * - DOUBLE TEN: 10 hits (todas las primeras 10 posiciones)
 * - DOUBLE TWENTY: 20 hits (todas las 20 posiciones)
 * - TERN HEAD: 1 hit
 * - TERN FIVE: 5 hits
 * - TERN TEN: 10 hits
 * - TERN TWENTY: 20 hits
 * - QUATERN HEAD: 1 hit (exacto)
 * - QUATERN FIVE: 5 hits
 * - QUATERN TEN: 10 hits
 * - QUATERN TWENTY: 20 hits
 * - BORRATINA: 5+ coincidencias (paga 1200x)
 * - REDOUBLE: máximo hits según combinación
 */

import { v4 as uuidv4 } from 'uuid';

// Estrategia: usar números repetidos que maximicen coincidencias
export const RESULTS_MAX_HITS = {
  lottery_1: [
    // Todas terminan en 12 para DOUBLE, contienen 912 para TERN, son 5912 para QUATERN
    5912,
    5912,
    5912,
    5912,
    5912, // posiciones 1-5: FIVE
    5912,
    5912,
    5912,
    5912,
    5912, // posiciones 6-10: TEN
    5912,
    5912,
    5912,
    5912,
    5912, // posiciones 11-15: parte de TWENTY
    5912,
    5912,
    5912,
    5912,
    5912, // posiciones 16-20: TWENTY completo
  ],
  lottery_2: [
    5912, 5912, 5912, 5912, 5912, 5912, 5912, 5912, 5912, 5912, 5912, 5912, 5912, 5912, 5912, 5912,
    5912, 5912, 5912, 5912,
  ],
  lottery_3: [
    5912, 5912, 5912, 5912, 5912, 5912, 5912, 5912, 5912, 5912, 5912, 5912, 5912, 5912, 5912, 5912,
    5912, 5912, 5912, 5912,
  ],
  lottery_4: [
    5912, 5912, 5912, 5912, 5912, 5912, 5912, 5912, 5912, 5912, 5912, 5912, 5912, 5912, 5912, 5912,
    5912, 5912, 5912, 5912,
  ],
  lottery_5: [
    5912, 5912, 5912, 5912, 5912, 5912, 5912, 5912, 5912, 5912, 5912, 5912, 5912, 5912, 5912, 5912,
    5912, 5912, 5912, 5912,
  ],
};

export function generateMaxHitsResults(
  date: string,
  scheduleId: string,
  lotteryIndex: number
): any {
  const lotteryKey = `lottery_${lotteryIndex + 1}` as keyof typeof RESULTS_MAX_HITS;
  return {
    results_id: uuidv4(),
    date,
    schedule_id: scheduleId,
    results: RESULTS_MAX_HITS[lotteryKey],
  };
}
