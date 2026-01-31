import { v4 as uuidv4 } from 'uuid';
import { TEST_ORG_ID } from './users.fixture.js';

// 5 Schedules (turnos)
export const TEST_SCHEDULES = [
  {
    schedule_id: uuidv4(),
    organization_id: TEST_ORG_ID,
    name: 'Matutina',
    time: '10:00:00',
    active: true,
  },
  {
    schedule_id: uuidv4(),
    organization_id: TEST_ORG_ID,
    name: 'Mediodía',
    time: '12:30:00',
    active: true,
  },
  {
    schedule_id: uuidv4(),
    organization_id: TEST_ORG_ID,
    name: 'Vespertina',
    time: '17:00:00',
    active: true,
  },
  {
    schedule_id: uuidv4(),
    organization_id: TEST_ORG_ID,
    name: 'Nocturna',
    time: '21:00:00',
    active: true,
  },
  {
    schedule_id: uuidv4(),
    organization_id: TEST_ORG_ID,
    name: 'Especial',
    time: '23:30:00',
    active: true,
  },
];

// 5 Lotteries
export const TEST_LOTTERIES = [
  {
    lottery_id: uuidv4(),
    organization_id: TEST_ORG_ID,
    name: 'Nacional',
    active: true,
    order: 1,
  },
  {
    lottery_id: uuidv4(),
    organization_id: TEST_ORG_ID,
    name: 'Provincia',
    active: true,
    order: 2,
  },
  {
    lottery_id: uuidv4(),
    organization_id: TEST_ORG_ID,
    name: 'Santa Fe',
    active: true,
    order: 3,
  },
  {
    lottery_id: uuidv4(),
    organization_id: TEST_ORG_ID,
    name: 'Córdoba',
    active: true,
    order: 4,
  },
  {
    lottery_id: uuidv4(),
    organization_id: TEST_ORG_ID,
    name: 'Entre Ríos',
    active: true,
    order: 5,
  },
];

// Schedule-Lottery mapping (Lunes a Sábado = días 1-6)
export const TEST_SCHEDULE_LOTTERIES: any[] = [];
for (const schedule of TEST_SCHEDULES) {
  for (const lottery of TEST_LOTTERIES) {
    for (let day = 1; day <= 6; day++) {
      TEST_SCHEDULE_LOTTERIES.push({
        id: uuidv4(),
        organization_id: TEST_ORG_ID,
        schedule_id: schedule.schedule_id,
        lottery_id: lottery.lottery_id,
        day: day,
      });
    }
  }
}
