import { describe, expect, it } from 'vitest';
import { pollaDrawLabels } from '@helper/polla/types/game.type';

const uuid = (n: number) => `00000000-0000-0000-0000-${String(n).padStart(12, '0')}`;

const NACIONAL = uuid(1);
const PROVINCIA = uuid(2);
const CORDOBA = uuid(3);
const MATUTINA = uuid(10);
const NOCTURNA = uuid(11);

const draw = (lottery: string, schedule: string) => ({
  polla_lottery_id: lottery,
  polla_schedule_id: schedule,
});

const schedules = [
  { polla_schedule_id: NOCTURNA, name: 'Nocturna', time: '21:00:00' },
  { polla_schedule_id: MATUTINA, name: 'Matutina', time: '11:30:00' },
];

describe('orden y etiqueta de las quinielas (R28)', () => {
  // El orden lo define la organización: acá Provincia es la primera.
  const lotteries = [
    { polla_lottery_id: NACIONAL, name: 'Nacional', order: 2, position: 2, label: '2 - Nacional' },
    {
      polla_lottery_id: PROVINCIA,
      name: 'Provincia',
      order: 1,
      position: 1,
      label: '1 - Provincia',
    },
    { polla_lottery_id: CORDOBA, name: 'Córdoba', order: 3, position: 3, label: '3 - Córdoba' },
  ];

  it('cada sorteo lleva "posición - quiniela · turno"', () => {
    expect(pollaDrawLabels([draw(NACIONAL, NOCTURNA)], { lotteries, schedules })).toEqual([
      '2 - Nacional · Nocturna',
    ]);
  });

  it('ordena por horario del turno y después por la posición de la quiniela', () => {
    const draws = [
      draw(NACIONAL, NOCTURNA),
      draw(CORDOBA, MATUTINA),
      draw(NACIONAL, MATUTINA),
      draw(PROVINCIA, MATUTINA),
    ];
    expect(pollaDrawLabels(draws, { lotteries, schedules })).toEqual([
      '1 - Provincia · Matutina',
      '2 - Nacional · Matutina',
      '3 - Córdoba · Matutina',
      '2 - Nacional · Nocturna',
    ]);
  });

  it('sin catálogo usa la etiqueta y la posición que manda la edición', () => {
    const draws = [
      { ...draw(CORDOBA, NOCTURNA), lottery_position: 3, lottery_label: '3 - Córdoba' },
      { ...draw(PROVINCIA, NOCTURNA), lottery_position: 1, lottery_label: '1 - Provincia' },
    ];
    expect(pollaDrawLabels(draws, { schedules })).toEqual([
      '1 - Provincia · Nocturna',
      '3 - Córdoba · Nocturna',
    ]);
  });

  it('una quiniela borrada (sin posición) queda con su nombre, al final de su turno', () => {
    const draws = [draw(uuid(99), NOCTURNA), draw(NACIONAL, NOCTURNA)];
    const withDeleted = [...lotteries, { polla_lottery_id: uuid(99), name: 'Vieja' }];
    expect(pollaDrawLabels(draws, { lotteries: withDeleted, schedules })).toEqual([
      '2 - Nacional · Nocturna',
      'Vieja · Nocturna',
    ]);
  });
});
