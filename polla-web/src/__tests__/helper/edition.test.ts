import { describe, expect, it } from 'vitest';
import { newPollaEditionSchema, updatePollaEditionSchema } from '@helper/polla/schemas/game.schema';
import {
  isPollaSpecialEdition,
  pollaEditionDrawLabels,
  pollaEditionDraws,
  pollaEditionTitle,
  pollaPrizeRuleLabel,
} from '@helper/polla/types/game.type';

const uuid = (n: number) => `00000000-0000-0000-0000-${String(n).padStart(12, '0')}`;

const NACIONAL = uuid(1);
const PROVINCIA = uuid(2);
const SANTA_FE = uuid(3);
const NOCTURNA = uuid(10);
const VESPERTINA = uuid(11);

const catalogs = {
  lotteries: [
    { polla_lottery_id: SANTA_FE, name: 'Santa Fe', order: 3 },
    { polla_lottery_id: NACIONAL, name: 'Nacional', order: 1 },
    { polla_lottery_id: PROVINCIA, name: 'Provincia', order: 2 },
  ],
  schedules: [
    { polla_schedule_id: NOCTURNA, name: 'Nocturna', time: '21:00:00' },
    { polla_schedule_id: VESPERTINA, name: 'Vespertina', time: '18:00:00' },
  ],
};

const draw = (lottery: string, schedule: string) => ({
  polla_lottery_id: lottery,
  polla_schedule_id: schedule,
});

const special = {
  name: 'Especial del sábado',
  polla_lottery_id: NACIONAL,
  polla_schedule_id: NOCTURNA,
  min_winning_hits: 8,
  draws: [draw(SANTA_FE, NOCTURNA), draw(NACIONAL, NOCTURNA), draw(PROVINCIA, NOCTURNA)],
};

const regular = {
  name: null,
  polla_lottery_id: NACIONAL,
  polla_schedule_id: NOCTURNA,
  min_winning_hits: 10,
  draws: [draw(NACIONAL, NOCTURNA)],
};

describe('pollaEditionDrawLabels', () => {
  it('nombra cada sorteo y los ordena por hora del turno y orden de la quiniela', () => {
    const edition = {
      ...special,
      draws: [...special.draws, draw(SANTA_FE, VESPERTINA)],
    };
    expect(pollaEditionDrawLabels(edition, catalogs)).toEqual([
      'Santa Fe · Vespertina',
      'Nacional · Nocturna',
      'Provincia · Nocturna',
      'Santa Fe · Nocturna',
    ]);
  });

  it('sin catálogo cargado dice Quiniela / Turno', () => {
    expect(pollaEditionDrawLabels(regular, {})).toEqual(['Quiniela · Turno']);
  });

  it('sin sorteos (datos viejos) usa el principal', () => {
    expect(pollaEditionDraws({ ...regular, draws: undefined })).toEqual([draw(NACIONAL, NOCTURNA)]);
  });
});

describe('pollaEditionTitle', () => {
  it('la regular sin nombre es su quiniela y turno', () => {
    expect(pollaEditionTitle(regular, catalogs)).toBe('Nacional · Nocturna');
  });

  it('la especial lleva el nombre y todos sus sorteos separados por coma', () => {
    expect(pollaEditionTitle(special, catalogs)).toBe(
      'Especial del sábado · Nacional · Nocturna, Provincia · Nocturna, Santa Fe · Nocturna'
    );
  });
});

describe('isPollaSpecialEdition y pollaPrizeRuleLabel', () => {
  it('la regular no es especial y premia solo 10', () => {
    expect(isPollaSpecialEdition(regular)).toBe(false);
    expect(pollaPrizeRuleLabel(regular)).toBe('Ganan los que aciertan 10');
  });

  it('con varios sorteos o mínimo menor a 10 es especial', () => {
    expect(isPollaSpecialEdition(special)).toBe(true);
    expect(isPollaSpecialEdition({ ...regular, min_winning_hits: 9 })).toBe(true);
    expect(isPollaSpecialEdition({ ...special, min_winning_hits: 10 })).toBe(true);
  });

  it('con mínimo dice desde cuántos aciertos baja la escalera', () => {
    expect(pollaPrizeRuleLabel(special)).toBe(
      'Ganan los de 10; si nadie, los de más aciertos desde 8'
    );
  });
});

describe('newPollaEditionSchema', () => {
  const base = {
    start_date: '2026-11-07',
    end_date: '2026-11-07',
    load_limit_date: '2026-11-07',
    load_limit_time: '20:00',
    pool_amount: 100000,
    ticket_price: 1000,
  };

  it('acepta una especial con varios sorteos y mínimo 8', () => {
    const parsed = newPollaEditionSchema.safeParse({
      ...base,
      draws: special.draws,
      min_winning_hits: 8,
    });
    expect(parsed.success).toBe(true);
  });

  it('pide al menos un sorteo', () => {
    const parsed = newPollaEditionSchema.safeParse({ ...base, draws: [] });
    expect(parsed.success).toBe(false);
    expect(parsed.error?.errors[0]?.message).toBe('Elegí al menos un sorteo (quiniela y turno)');
  });

  it('no acepta sorteos repetidos', () => {
    const parsed = newPollaEditionSchema.safeParse({
      ...base,
      draws: [draw(NACIONAL, NOCTURNA), draw(NACIONAL, NOCTURNA)],
    });
    expect(parsed.success).toBe(false);
    expect(parsed.error?.errors[0]?.message).toBe('Hay sorteos repetidos');
  });

  it('el mínimo de aciertos va de 1 a 10', () => {
    expect(
      newPollaEditionSchema.safeParse({ ...base, draws: special.draws, min_winning_hits: 0 })
        .success
    ).toBe(false);
    expect(
      newPollaEditionSchema.safeParse({ ...base, draws: special.draws, min_winning_hits: 11 })
        .success
    ).toBe(false);
    expect(
      newPollaEditionSchema.safeParse({ ...base, draws: special.draws, min_winning_hits: 8.5 })
        .success
    ).toBe(false);
  });

  it('en un cambio los sorteos son opcionales, pero si vienen no pueden estar vacíos', () => {
    expect(updatePollaEditionSchema.safeParse({ name: 'Otra' }).success).toBe(true);
    expect(updatePollaEditionSchema.safeParse({ draws: [] }).success).toBe(false);
  });
});
