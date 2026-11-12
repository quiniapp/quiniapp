import { describe, expect, it } from 'vitest';
import { newPollaEditionSchema, updatePollaEditionSchema } from '@helper/polla/schemas/game.schema';

const uuid = (n: number) => `00000000-0000-0000-0000-${String(n).padStart(12, '0')}`;

const base = {
  draws: [{ polla_lottery_id: uuid(1), polla_schedule_id: uuid(2) }],
  start_date: '2026-11-14',
  end_date: '2026-11-14',
  load_limit_date: '2026-11-14',
  load_limit_time: '20:00',
  pool_amount: 1000,
  ticket_price: 100,
};

describe('inicio de carga en la edición (R29)', () => {
  it('sin inicio de carga es válida (la base toma ahora)', () => {
    expect(newPollaEditionSchema.safeParse(base).success).toBe(true);
  });

  it('se crea el jueves y abre el sábado a la tarde', () => {
    const parsed = newPollaEditionSchema.safeParse({
      ...base,
      load_start_date: '2026-11-14',
      load_start_time: '14:00',
    });
    expect(parsed.success).toBe(true);
  });

  it('el inicio tiene que ser antes del cierre', () => {
    const parsed = newPollaEditionSchema.safeParse({
      ...base,
      load_start_date: '2026-11-14',
      load_start_time: '20:00',
    });
    expect(parsed.success).toBe(false);
    expect(parsed.error?.errors[0]?.message).toBe(
      'El inicio de carga tiene que ser antes del cierre de carga'
    );
  });

  it('al editar valida si vienen las cuatro puntas', () => {
    expect(
      updatePollaEditionSchema.safeParse({
        load_start_date: '2026-11-15',
        load_start_time: '09:00',
        load_limit_date: '2026-11-14',
        load_limit_time: '20:00',
      }).success
    ).toBe(false);
  });

  it('con solo el inicio, el resto lo controla la base', () => {
    expect(
      updatePollaEditionSchema.safeParse({
        load_start_date: '2026-11-15',
        load_start_time: '09:00',
      }).success
    ).toBe(true);
  });
});
