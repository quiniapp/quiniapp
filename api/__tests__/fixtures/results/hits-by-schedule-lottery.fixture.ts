import { v4 as uuidv4 } from 'uuid';

/**
 * Results diseñados con números repetidos simples (1111, 2222, etc.)
 * Mapea cada combinación de schedule×lottery a un número específico de hits
 *
 * Estrategia:
 * - Usar números repetidos: 1111, 2222, 3333, 4444, 5555, 6666, 7777, 8888, 9999, 0000
 * - Las jugadas usarán estos mismos números para coincidir según el escenario
 * - Cada schedule-lottery tiene un número target de hits
 */

/**
 * Mapa de hits por schedule y lottery
 * Schedule 0-4 (5 schedules) × Lottery 0-4 (5 lotteries) = 25 combinaciones
 *
 * Distribución de hits:
 * - 0 hits: 5 combinaciones (1 por schedule)
 * - 1-5 hits: 10 combinaciones (2 schedules × 5 lotteries)
 * - 6-10 hits: 5 combinaciones (1 schedule)
 * - 11-20 hits: 5 combinaciones (1 schedule)
 */
export const HITS_MAP: Record<number, Record<number, number>> = {
  // Schedule 0: Todas pierden (0 hits) para todos los cashiers
  0: { 0: 0, 1: 0, 2: 0, 3: 0, 4: 0 },

  // Schedule 1: 1-5 hits distribuidos
  1: { 0: 1, 1: 2, 2: 3, 3: 4, 4: 5 },

  // Schedule 2: 6-10 hits distribuidos
  2: { 0: 6, 1: 7, 2: 8, 3: 9, 4: 10 },

  // Schedule 3: 11-15 hits distribuidos
  3: { 0: 11, 1: 12, 2: 13, 3: 14, 4: 15 },

  // Schedule 4: 16-20 hits distribuidos
  4: { 0: 16, 1: 17, 2: 18, 3: 19, 4: 20 },
};

/**
 * Genera un array de results con N posiciones que coincidan con el número apostado
 *
 * Para generar N hits:
 * - Llenar las primeras N posiciones con el número target (ej: 1111)
 * - Llenar el resto (20-N posiciones) con números diferentes (ej: 9999)
 *
 * Ejemplo para 3 hits con número 1111:
 * [1111, 1111, 1111, 9999, 9999, ..., 9999]
 */
function generateResultsWithHits(targetHits: number, targetNumber: number = 1111): number[] {
  const results: number[] = [];

  // Primeras targetHits posiciones: número que coincide
  for (let i = 0; i < targetHits; i++) {
    results.push(targetNumber);
  }

  // Resto de posiciones (hasta 20): números que NO coinciden
  const noMatchNumber = 9999;
  for (let i = targetHits; i < 20; i++) {
    results.push(noMatchNumber);
  }

  return results;
}

/**
 * Genera results para una combinación específica de schedule y lottery
 */
export function generateResultsByScheduleLottery(
  date: string,
  scheduleId: string,
  lotteryId: string,
  scheduleIndex: number,
  lotteryIndex: number
): any {
  const targetHits = HITS_MAP[scheduleIndex]?.[lotteryIndex] ?? 0;

  return {
    results_id: uuidv4(),
    date,
    schedule_id: scheduleId,
    lottery_id: lotteryId,
    results: generateResultsWithHits(targetHits),
  };
}

/**
 * Helper para obtener el número de hits esperado para una combinación
 */
export function getExpectedHits(scheduleIndex: number, lotteryIndex: number): number {
  return HITS_MAP[scheduleIndex]?.[lotteryIndex] ?? 0;
}
