/**
 * Results que garantizan 0 hits para todas las jugadas
 *
 * Estrategia:
 * - Usar números que NO aparezcan en ninguna jugada de ningún cashier
 * - Evitar patrones comunes (00, 11, 22, etc.)
 * - Usar secuencias específicas para cada lotería
 */

export const RESULTS_NO_WINNERS = {
  lottery_1: [
    7823,
    4561,
    9012,
    3478,
    6209, // posiciones 1-5
    1854,
    2967,
    4130,
    5742,
    8395, // posiciones 6-10
    9508,
    627,
    1349,
    2461,
    3572, // posiciones 11-15
    4683,
    5794,
    6805,
    7916,
    8027, // posiciones 16-20
  ],
  lottery_2: [
    8934, 5672, 123, 4589, 7310, 2965, 4078, 5241, 6853, 9406, 619, 1738, 2450, 3572, 4683, 5794,
    6805, 7916, 8027, 9138,
  ],
  lottery_3: [
    9045, 6783, 1234, 5690, 8421, 3076, 5189, 6352, 7964, 517, 1720, 2849, 3561, 4683, 5794, 6805,
    7916, 8027, 9138, 249,
  ],
  lottery_4: [
    156, 7894, 2345, 6701, 9532, 4187, 6290, 7463, 8075, 1628, 2831, 3950, 4672, 5794, 6805, 7916,
    8027, 9138, 249, 1350,
  ],
  lottery_5: [
    1267, 8905, 3456, 7812, 643, 5298, 7301, 8574, 9186, 2739, 3942, 4061, 5783, 6805, 7916, 8027,
    9138, 249, 1350, 2461,
  ],
};

import { v4 as uuidv4 } from 'uuid';

// Helper para generar results para una fecha específica
export function generateNoWinnersResults(
  date: string,
  scheduleId: string,
  lotteryIndex: number
): any {
  const lotteryKey = `lottery_${lotteryIndex + 1}` as keyof typeof RESULTS_NO_WINNERS;
  return {
    results_id: uuidv4(),
    date,
    schedule_id: scheduleId,
    results: RESULTS_NO_WINNERS[lotteryKey],
  };
}
