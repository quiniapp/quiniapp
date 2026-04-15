import { describe, test, expect, beforeAll, afterAll } from '@jest/globals';
import dayjs from 'dayjs';
import { v4 as uuidv4 } from 'uuid';
import dotenv from 'dotenv';

// Cargar variables de entorno para tests
dotenv.config();

import {
  cleanTestDatabase,
  createTestOrganization,
  createTestUsers,
  createTestSchedules,
  createTestLotteries,
  createTestScheduleLotteries,
  createTestTickets,
  createTestBets,
  createTestResults,
} from '../helpers/index.js';

import { TEST_ORG_ID, TEST_OWNER, TEST_CASHIERS } from '../fixtures/users.fixture.js';

import {
  TEST_SCHEDULES,
  TEST_LOTTERIES,
  TEST_SCHEDULE_LOTTERIES,
} from '../fixtures/schedules.fixture.js';

import { generateSimpleBetsForCashier } from '../fixtures/bets/generate-bets-simple.fixture.js';
import { generateResultsByScheduleLottery, getExpectedHits } from '../fixtures/results/index.js';

import { supabase } from '../../database/db.connection.js';

describe('Winners, Results and Current Account - E2E Test Suite', () => {
  const startDate = dayjs('2026-02-02'); // Lunes

  // === SETUP GLOBAL ===
  beforeAll(async () => {
    console.log('\n=== 🚀 INICIANDO SUITE DE TESTS E2E ===\n');

    // 1. Limpiar BD
    console.log('1️⃣ Limpiando base de datos...');
    await cleanTestDatabase();

    // 2. Crear organización
    console.log('2️⃣ Creando organización de prueba...');
    await createTestOrganization(TEST_ORG_ID, 'Test Organization');

    // 3. Crear usuarios (owner + 6 cashiers)
    console.log('3️⃣ Creando usuarios de prueba...');
    await createTestUsers([TEST_OWNER, ...TEST_CASHIERS]);

    // 4. Crear schedules
    console.log('4️⃣ Creando schedules (turnos)...');
    await createTestSchedules(TEST_SCHEDULES);

    // 5. Crear lotteries
    console.log('5️⃣ Creando lotteries...');
    await createTestLotteries(TEST_LOTTERIES);

    // 6. Crear schedule_lotteries
    console.log('6️⃣ Creando relaciones schedule-lottery...');
    await createTestScheduleLotteries(TEST_SCHEDULE_LOTTERIES);

    console.log('\n✅ Setup completado exitosamente\n');
  });

  // === CLEANUP ===
  afterAll(async () => {
    console.log('\n=== 🧹 LIMPIANDO RECURSOS ===\n');
    // Opcional: limpiar BD después de todos los tests
    // await cleanTestDatabase();
  });

  // === TEST: DÍA 1 ===
  test('Día 1: Crear jugadas, results y validar premios', async () => {
    const currentDate = startDate.format('YYYY-MM-DD');
    console.log(`\n📅 Procesando día 1: ${currentDate}`);

    // Contador de tickets para generar números únicos
    let ticketCounter = 1;

    // Para cada schedule
    for (let scheduleIndex = 0; scheduleIndex < TEST_SCHEDULES.length; scheduleIndex++) {
      const schedule = TEST_SCHEDULES[scheduleIndex];
      console.log(`\n  📋 Schedule ${scheduleIndex}: ${schedule.name}`);

      // Para cada lottery
      for (let lotteryIndex = 0; lotteryIndex < TEST_LOTTERIES.length; lotteryIndex++) {
        const lottery = TEST_LOTTERIES[lotteryIndex];
        const expectedHits = getExpectedHits(scheduleIndex, lotteryIndex);
        console.log(
          `    🎰 Lottery ${lotteryIndex}: ${lottery.name} (${expectedHits} hits esperados)`
        );

        // 1. Crear results para esta combinación schedule-lottery
        const resultData = generateResultsByScheduleLottery(
          currentDate,
          schedule.schedule_id,
          lottery.lottery_id,
          scheduleIndex,
          lotteryIndex
        );

        await createTestResults([
          {
            ...resultData,
            organization_id: TEST_ORG_ID,
          },
        ]);

        // 2. Para cada cashier, crear tickets y bets
        for (const cashier of TEST_CASHIERS) {
          const bets = generateSimpleBetsForCashier({
            cashierId: cashier.user_id,
            scenario: cashier.scenario,
            date: currentDate,
            scheduleId: schedule.schedule_id,
            lotteryId: lottery.lottery_id,
            organizationId: TEST_ORG_ID,
          });

          // Crear tickets (1 bet por ticket)
          for (const bet of bets) {
            const ticketId = uuidv4();
            const ticketNumber = ticketCounter;
            ticketCounter++;

            // Crear ticket
            await createTestTickets([
              {
                ticket_id: ticketId,
                ticket_number: ticketNumber,
                user_id: cashier.user_id,
                user_name: cashier.name,
                date: currentDate,
                total: bet.amount,
                winner: false,
                paid: false,
                deleted_at: null,
                organization_id: TEST_ORG_ID,
              },
            ]);

            // Crear bet asociado al ticket
            await createTestBets([
              {
                ...bet,
                ticket_id: ticketId,
                ticket_number: ticketNumber.toString(),
                cashier_name: cashier.name,
              },
            ]);
          }
        }
      }

      // 3. Ejecutar generate_winners para este schedule
      console.log(`\n  ⚡ Ejecutando generate_winners para ${schedule.name}...`);

      const { error: winnersError } = await supabase.rpc(
        'generate_winners_and_calculate_accounts',
        {
          p_schedule_id: schedule.schedule_id,
          p_date: currentDate,
          p_organization_id: TEST_ORG_ID,
        }
      );

      if (winnersError) {
        console.error('Error ejecutando generate_winners:', winnersError);
        throw winnersError;
      }

      console.log(`  ✓ Winners generados exitosamente`);
    }

    // 4. Validar bets ganadores
    console.log('\n  🔍 Validando bets ganadores...');

    for (const cashier of TEST_CASHIERS) {
      const { data: bets, error: betsError } = await supabase
        .from('bets')
        .select('*')
        .eq('user_id', cashier.user_id)
        .eq('date', currentDate);

      if (betsError) {
        console.error('Error leyendo bets:', betsError);
        throw betsError;
      }

      console.log(`\n    👤 ${cashier.name} (${cashier.scenario}):`);
      console.log(`       Total bets: ${bets?.length}`);

      if (bets) {
        const winnerBets = bets.filter((b) => b.winner === true);
        const totalPrize = bets.reduce((sum, b) => sum + (b.prize || 0), 0);
        const totalHits = bets.reduce((sum, b) => sum + (b.hits || 0), 0);

        console.log(`       Ganadores: ${winnerBets.length}`);
        console.log(`       Total hits: ${totalHits}`);
        console.log(`       Premio total: $${totalPrize.toFixed(2)}`);

        // Validaciones básicas según escenario
        if (cashier.scenario === 'HITS_0') {
          expect(winnerBets.length).toBe(0);
          expect(totalPrize).toBe(0);
          expect(totalHits).toBe(0);
        } else {
          // Para otros escenarios, debe haber ganadores
          expect(winnerBets.length).toBeGreaterThan(0);
          expect(totalHits).toBeGreaterThan(0);
        }

        // Mostrar detalle de hits por schedule-lottery
        const hitsByScheduleLottery: Record<string, number> = {};
        for (const bet of bets) {
          const key = `S${TEST_SCHEDULES.findIndex((s) => s.schedule_id === bet.schedule_id)}-L${TEST_LOTTERIES.findIndex((l) => l.lottery_id === bet.lottery_id)}`;
          hitsByScheduleLottery[key] = (hitsByScheduleLottery[key] || 0) + bet.hits;
        }
        console.log(`       Hits por S-L:`, hitsByScheduleLottery);
      }
    }

    // 5. Validar current accounts
    console.log('\n  💰 Validando current accounts...');

    const { data: accounts, error: accountsError } = await supabase
      .from('current_accounts')
      .select('*')
      .eq('date', currentDate)
      .eq('organization_id', TEST_ORG_ID);

    if (accountsError) {
      console.error('Error leyendo current accounts:', accountsError);
      throw accountsError;
    }

    expect(accounts).toBeDefined();
    expect(accounts?.length).toBe(TEST_CASHIERS.length);

    for (const cashier of TEST_CASHIERS) {
      const account = accounts?.find((a) => a.user_id === cashier.user_id);
      expect(account).toBeDefined();

      console.log(`\n    👤 ${cashier.name}:`);
      console.log(`       Pass: $${account?.pass || 0}`);
      console.log(`       Premios: $${account?.successes || 0}`);
      console.log(`       Revenue: $${account?.revenue || 0}`);
      console.log(`       Comisión: $${account?.cashier_commission || 0}`);
      console.log(`       Drag: $${account?.drag || 0}`);
      console.log(`       Total: $${account?.total || 0}`);

      // Validaciones básicas
      if (account) {
        expect(account.pass).toBeGreaterThan(0);
        expect(account.cashier_commission).toBeCloseTo(account.pass * 0.2, 2);

        if (cashier.scenario === 'HITS_0') {
          expect(account.successes).toBe(0);
          expect(account.revenue).toBeCloseTo(account.pass * 0.8, 2);
        }

        // Drag: cashiers con fee_plus > 0 pueden tener drag positivo o negativo
        // Cashiers con fee_plus = 0 siempre tienen drag = 0
        if (cashier.fee_plus > 0) {
          expect(account.drag).toBeDefined();
          expect(typeof account.drag).toBe('number');
        } else {
          expect(account.drag).toBe(0);
        }
      }
    }

    console.log('\n✅ Día 1 completado exitosamente');
  }, 120000); // timeout 2 minutos
});
