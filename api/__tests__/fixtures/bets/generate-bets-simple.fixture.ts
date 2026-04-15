import { v4 as uuidv4 } from 'uuid';

/**
 * Genera jugadas simples usando números repetidos (1111, 2222, etc.)
 *
 * Estrategia por escenario:
 * - HITS_0: Usar 8888 (nunca coincide con results que usan 1111/9999)
 * - HITS_1_TO_5: Usar 1111 en tipos que pueden dar 1-5 hits (DOUBLE FIVE, etc.)
 * - HITS_6_TO_10: Usar 1111 en tipos que pueden dar 6-10 hits (DOUBLE TEN, etc.)
 * - HITS_11_TO_20: Usar 1111 en tipos que pueden dar 11-20 hits (DOUBLE TWENTY, etc.)
 */

interface BetGeneratorParams {
  cashierId: string;
  scenario: 'HITS_0' | 'HITS_1_TO_5' | 'HITS_6_TO_10' | 'HITS_11_TO_20';
  date: string;
  scheduleId: string;
  lotteryId: string;
  organizationId: string;
}

const BET_NUMBERS = {
  HITS_0: {
    // Números que nunca coinciden
    ONE: '8',
    DOUBLE: '88',
    TERN: '888',
    QUATERN: '8888',
    BORRATINA: '8888888888',
    REDOUBLE: { number: '88', with: '77' },
  },
  HITS_1_TO_5: {
    // Números que pueden dar 1-5 hits con FIVE
    ONE: '1', // termina en 1
    DOUBLE: '11', // termina en 11
    TERN: '111', // termina en 111
    QUATERN: '1111', // exacto 1111
    BORRATINA: '1111111111',
    REDOUBLE: { number: '11', with: '11' },
  },
  HITS_6_TO_10: {
    // Números que pueden dar 6-10 hits con TEN
    ONE: '1',
    DOUBLE: '11',
    TERN: '111',
    QUATERN: '1111',
    BORRATINA: '1111111111',
    REDOUBLE: { number: '11', with: '11' },
  },
  HITS_11_TO_20: {
    // Números que pueden dar 11-20 hits con TWENTY
    ONE: '1',
    DOUBLE: '11',
    TERN: '111',
    QUATERN: '1111',
    BORRATINA: '1111111111',
    REDOUBLE: { number: '11', with: '11' },
  },
};

export function generateSimpleBetsForCashier(params: BetGeneratorParams) {
  const { cashierId, scenario, date, scheduleId, lotteryId, organizationId } = params;
  const numbers = BET_NUMBERS[scenario];

  const bets = [];

  // Seleccionar qué tipos de jugadas crear según el escenario
  // Para HITS_0: todas las jugadas (no van a ganar)
  // Para HITS_1_TO_5: solo usar FIVE y HEAD para limitar hits
  // Para HITS_6_TO_10: usar TEN
  // Para HITS_11_TO_20: usar TWENTY

  if (scenario === 'HITS_0') {
    // Crear todas las jugadas (26 total) que van a perder
    bets.push(
      // ONE HEAD
      {
        bet_id: uuidv4(),
        organization_id: organizationId,
        bet_type: 'ONE' as const,
        place: 'HEAD' as const,
        number: numbers.ONE,
        amount: 1,
        with: null,
        position: null,
        user_id: cashierId,
        date,
        schedule_id: scheduleId,
        lottery_id: lotteryId,
        winner: false,
        paid: false,
        prize: 0,
        hits: 0,
      },
      // DOUBLE HEAD
      {
        bet_id: uuidv4(),
        organization_id: organizationId,
        bet_type: 'DOUBLE' as const,
        place: 'HEAD' as const,
        number: numbers.DOUBLE,
        amount: 1,
        with: null,
        position: null,
        user_id: cashierId,
        date,
        schedule_id: scheduleId,
        lottery_id: lotteryId,
        winner: false,
        paid: false,
        prize: 0,
        hits: 0,
      }
    );
  } else if (scenario === 'HITS_1_TO_5') {
    // Crear jugadas FIVE para obtener 1-5 hits según los results
    bets.push(
      // DOUBLE FIVE
      {
        bet_id: uuidv4(),
        organization_id: organizationId,
        bet_type: 'DOUBLE' as const,
        place: 'FIVE' as const,
        number: numbers.DOUBLE,
        amount: 1,
        with: null,
        position: null,
        user_id: cashierId,
        date,
        schedule_id: scheduleId,
        lottery_id: lotteryId,
        winner: false,
        paid: false,
        prize: 0,
        hits: 0,
      },
      // TERN FIVE
      {
        bet_id: uuidv4(),
        organization_id: organizationId,
        bet_type: 'TERN' as const,
        place: 'FIVE' as const,
        number: numbers.TERN,
        amount: 1,
        with: null,
        position: null,
        user_id: cashierId,
        date,
        schedule_id: scheduleId,
        lottery_id: lotteryId,
        winner: false,
        paid: false,
        prize: 0,
        hits: 0,
      },
      // QUATERN FIVE
      {
        bet_id: uuidv4(),
        organization_id: organizationId,
        bet_type: 'QUATERN' as const,
        place: 'FIVE' as const,
        number: numbers.QUATERN,
        amount: 1,
        with: null,
        position: null,
        user_id: cashierId,
        date,
        schedule_id: scheduleId,
        lottery_id: lotteryId,
        winner: false,
        paid: false,
        prize: 0,
        hits: 0,
      }
    );
  } else if (scenario === 'HITS_6_TO_10') {
    // Crear jugadas TEN para obtener 6-10 hits
    bets.push(
      // DOUBLE TEN
      {
        bet_id: uuidv4(),
        organization_id: organizationId,
        bet_type: 'DOUBLE' as const,
        place: 'TEN' as const,
        number: numbers.DOUBLE,
        amount: 1,
        with: null,
        position: null,
        user_id: cashierId,
        date,
        schedule_id: scheduleId,
        lottery_id: lotteryId,
        winner: false,
        paid: false,
        prize: 0,
        hits: 0,
      },
      // TERN TEN
      {
        bet_id: uuidv4(),
        organization_id: organizationId,
        bet_type: 'TERN' as const,
        place: 'TEN' as const,
        number: numbers.TERN,
        amount: 1,
        with: null,
        position: null,
        user_id: cashierId,
        date,
        schedule_id: scheduleId,
        lottery_id: lotteryId,
        winner: false,
        paid: false,
        prize: 0,
        hits: 0,
      },
      // QUATERN TEN
      {
        bet_id: uuidv4(),
        organization_id: organizationId,
        bet_type: 'QUATERN' as const,
        place: 'TEN' as const,
        number: numbers.QUATERN,
        amount: 1,
        with: null,
        position: null,
        user_id: cashierId,
        date,
        schedule_id: scheduleId,
        lottery_id: lotteryId,
        winner: false,
        paid: false,
        prize: 0,
        hits: 0,
      }
    );
  } else if (scenario === 'HITS_11_TO_20') {
    // Crear jugadas TWENTY para obtener 11-20 hits
    bets.push(
      // DOUBLE TWENTY
      {
        bet_id: uuidv4(),
        organization_id: organizationId,
        bet_type: 'DOUBLE' as const,
        place: 'TWENTY' as const,
        number: numbers.DOUBLE,
        amount: 1,
        with: null,
        position: null,
        user_id: cashierId,
        date,
        schedule_id: scheduleId,
        lottery_id: lotteryId,
        winner: false,
        paid: false,
        prize: 0,
        hits: 0,
      },
      // TERN TWENTY
      {
        bet_id: uuidv4(),
        organization_id: organizationId,
        bet_type: 'TERN' as const,
        place: 'TWENTY' as const,
        number: numbers.TERN,
        amount: 1,
        with: null,
        position: null,
        user_id: cashierId,
        date,
        schedule_id: scheduleId,
        lottery_id: lotteryId,
        winner: false,
        paid: false,
        prize: 0,
        hits: 0,
      },
      // QUATERN TWENTY
      {
        bet_id: uuidv4(),
        organization_id: organizationId,
        bet_type: 'QUATERN' as const,
        place: 'TWENTY' as const,
        number: numbers.QUATERN,
        amount: 1,
        with: null,
        position: null,
        user_id: cashierId,
        date,
        schedule_id: scheduleId,
        lottery_id: lotteryId,
        winner: false,
        paid: false,
        prize: 0,
        hits: 0,
      }
    );
  }

  return bets;
}
