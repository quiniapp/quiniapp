import { v4 as uuidv4 } from 'uuid';

/**
 * Genera jugadas para un cashier según su escenario
 *
 * Escenarios:
 * - NO_WINNERS: números que no aparecen en results
 * - ONE_HIT: números que dan exactamente 1 hit
 * - MAX_HITS: números que dan máximo hits
 */

interface BetGeneratorParams {
  cashierId: string;
  scenario: 'NO_WINNERS' | 'ONE_HIT' | 'MAX_HITS';
  date: string;
  scheduleId: string;
  lotteryId: string;
  organizationId: string;
}

// Números para cada escenario (deben coincidir con fixtures de results)
const BET_NUMBERS = {
  NO_WINNERS: {
    ONE: '3',
    DOUBLE: '99',
    TERN: '999',
    QUATERN: '9999',
    BORRATINA: '1122334455', // 5 pares que NO aparecen
    REDOUBLE: { number: '99', with: '88' },
  },
  ONE_HIT: {
    ONE: '4', // aparece en pos 1: xxxx4
    DOUBLE: '34', // aparece en pos 1: xx34
    TERN: '234', // aparece en pos 1: x234
    QUATERN: '1234', // aparece exacto en pos 1
    BORRATINA: '1234567890', // solo 1 par coincide
    REDOUBLE: { number: '25', with: '47' },
  },
  MAX_HITS: {
    ONE: '2', // si results todas terminan en x2
    DOUBLE: '12', // si results todas terminan en x12
    TERN: '912', // si results todas terminan en x912
    QUATERN: '5912', // si results todas son 5912
    BORRATINA: '1234567890', // todos los pares coinciden
    REDOUBLE: { number: '12', with: '12' }, // mismo número
  },
};

export function generateBetsForCashier(params: BetGeneratorParams) {
  const { cashierId, scenario, date, scheduleId, lotteryId, organizationId } = params;
  const numbers = BET_NUMBERS[scenario];

  const bets = [];

  // 1. ONE HEAD
  bets.push({
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
  });

  // 2-5. DOUBLE (HEAD, FIVE, TEN, TWENTY)
  for (const place of ['HEAD', 'FIVE', 'TEN', 'TWENTY'] as const) {
    bets.push({
      bet_id: uuidv4(),
      organization_id: organizationId,
      bet_type: 'DOUBLE' as const,
      place,
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
    });
  }

  // 6-9. TERN (HEAD, FIVE, TEN, TWENTY)
  for (const place of ['HEAD', 'FIVE', 'TEN', 'TWENTY'] as const) {
    bets.push({
      bet_id: uuidv4(),
      organization_id: organizationId,
      bet_type: 'TERN' as const,
      place,
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
    });
  }

  // 10-13. QUATERN (HEAD, FIVE, TEN, TWENTY)
  for (const place of ['HEAD', 'FIVE', 'TEN', 'TWENTY'] as const) {
    bets.push({
      bet_id: uuidv4(),
      organization_id: organizationId,
      bet_type: 'QUATERN' as const,
      place,
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
    });
  }

  // 14-17. BORRATINA (HEAD, FIVE, TEN, TWENTY)
  for (const place of ['HEAD', 'FIVE', 'TEN', 'TWENTY'] as const) {
    bets.push({
      bet_id: uuidv4(),
      organization_id: organizationId,
      bet_type: 'BORRATINA' as const,
      place,
      number: numbers.BORRATINA,
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
    });
  }

  // 18-26. REDOUBLE (9 combinaciones)
  const redoubleCombos = [
    { place: 'HEAD' as const, position: 'FIVE' as const },
    { place: 'HEAD' as const, position: 'TEN' as const },
    { place: 'HEAD' as const, position: 'TWENTY' as const },
    { place: 'FIVE' as const, position: 'FIVE' as const },
    { place: 'FIVE' as const, position: 'TEN' as const },
    { place: 'FIVE' as const, position: 'TWENTY' as const },
    { place: 'TEN' as const, position: 'TEN' as const },
    { place: 'TEN' as const, position: 'TWENTY' as const },
    { place: 'TWENTY' as const, position: 'TWENTY' as const },
  ];

  for (const combo of redoubleCombos) {
    bets.push({
      bet_id: uuidv4(),
      organization_id: organizationId,
      bet_type: 'REDOUBLE' as const,
      place: combo.place,
      position: combo.position,
      number: numbers.REDOUBLE.number,
      with: numbers.REDOUBLE.with,
      amount: 1,
      user_id: cashierId,
      date,
      schedule_id: scheduleId,
      lottery_id: lotteryId,
      winner: false,
      paid: false,
      prize: 0,
      hits: 0,
    });
  }

  return bets; // Total: 26 bets por schedule/lottery
}
