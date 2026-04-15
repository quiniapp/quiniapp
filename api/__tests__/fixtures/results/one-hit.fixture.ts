/**
 * Results que garantizan exactamente 1 hit para cada tipo de jugada
 *
 * Configuración por tipo:
 * - ONE HEAD: posición 1 termina en el número jugado (4)
 * - DOUBLE HEAD: posición 1 termina en XX (34)
 * - DOUBLE FIVE: exactamente 1 de las primeras 5 posiciones termina en XX (34)
 * - TERN HEAD: posición 1 termina en XXX (234)
 * - QUATERN HEAD: posición 1 = XXXX exacto (1234)
 * - BORRATINA: exactamente 1 par coincide en las primeras 18 posiciones
 * - REDOUBLE: number aparece en su rango, with aparece en su rango, pero solo 1 hit combinado
 */

import { v4 as uuidv4 } from 'uuid';

export const RESULTS_ONE_HIT = {
  lottery_1: [
    // Posición 1 (HEAD): diseñada para dar 1 hit a ONE, DOUBLE, TERN, QUATERN
    1234, // ONE: termina en 4, DOUBLE: termina en 34, TERN: termina en 234, QUATERN: exacto 1234

    // Posiciones 2-5 (completan FIVE): solo 5678 termina en 78 para DOUBLE FIVE
    5678,
    9012,
    3456,
    7890,

    // Posiciones 6-10 (completan TEN): sin hits adicionales
    1357,
    2468,
    3579,
    4680,
    5791,

    // Posiciones 11-20 (completan TWENTY): sin hits adicionales
    6802,
    7913,
    8024,
    9135,
    246,
    1358,
    2469,
    3570,
    4681,
    5792,
  ],
  lottery_2: [
    1234, 5678, 9012, 3456, 7890, 1357, 2468, 3579, 4680, 5791, 6802, 7913, 8024, 9135, 246, 1358,
    2469, 3570, 4681, 5792,
  ],
  lottery_3: [
    1234, 5678, 9012, 3456, 7890, 1357, 2468, 3579, 4680, 5791, 6802, 7913, 8024, 9135, 246, 1358,
    2469, 3570, 4681, 5792,
  ],
  lottery_4: [
    1234, 5678, 9012, 3456, 7890, 1357, 2468, 3579, 4680, 5791, 6802, 7913, 8024, 9135, 246, 1358,
    2469, 3570, 4681, 5792,
  ],
  lottery_5: [
    1234, 5678, 9012, 3456, 7890, 1357, 2468, 3579, 4680, 5791, 6802, 7913, 8024, 9135, 246, 1358,
    2469, 3570, 4681, 5792,
  ],
};

export function generateOneHitResults(date: string, scheduleId: string, lotteryIndex: number): any {
  const lotteryKey = `lottery_${lotteryIndex + 1}` as keyof typeof RESULTS_ONE_HIT;
  return {
    results_id: uuidv4(),
    date,
    schedule_id: scheduleId,
    results: RESULTS_ONE_HIT[lotteryKey],
  };
}
