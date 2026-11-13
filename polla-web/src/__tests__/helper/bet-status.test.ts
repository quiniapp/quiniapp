import { describe, expect, it } from 'vitest';
import {
  POLLA_BET_GAME_STATUS_LABEL,
  POLLA_EDITION_STATUS,
  POLLA_PAYMENT_STATUS,
  POLLA_PAYMENT_STATUS_LABEL,
  pollaBetGameStatus,
} from '@helper/polla/types/game.type';
import { newPollaBetSchema, markPollaBetsPaidSchema } from '@helper/polla/schemas/game.schema';

const uuid = (n: number) => `00000000-0000-0000-0000-${String(n).padStart(12, '0')}`;

describe('pollaBetGameStatus (R10)', () => {
  it('una ganadora es Ganadora, aunque la edición siga o haya terminado', () => {
    expect(pollaBetGameStatus({ winner: true }, POLLA_EDITION_STATUS.ACTIVE)).toBe('WON');
    expect(pollaBetGameStatus({ winner: true }, POLLA_EDITION_STATUS.FINISHED)).toBe('WON');
  });

  it('con la edición en juego sigue Jugando', () => {
    expect(pollaBetGameStatus({ winner: false }, POLLA_EDITION_STATUS.ACTIVE)).toBe('PLAYING');
  });

  it('sin saber la edición, también Jugando', () => {
    expect(pollaBetGameStatus({ winner: false })).toBe('PLAYING');
  });

  it('con la edición terminada y sin ganar, No ganó', () => {
    expect(pollaBetGameStatus({ winner: false }, POLLA_EDITION_STATUS.FINISHED)).toBe('LOST');
  });

  it('las etiquetas son las de la pantalla', () => {
    expect(POLLA_BET_GAME_STATUS_LABEL).toEqual({
      PLAYING: 'Jugando',
      WON: 'Ganadora',
      LOST: 'No ganó',
    });
    expect(POLLA_PAYMENT_STATUS_LABEL[POLLA_PAYMENT_STATUS.OWED]).toBe('Debe');
    expect(POLLA_PAYMENT_STATUS_LABEL[POLLA_PAYMENT_STATUS.PAID]).toBe('Pagado');
  });
});

describe('schemas de pago (R04, R13)', () => {
  const bet = {
    polla_edition_id: uuid(1),
    numbers: ['01', '02', '03', '04', '05', '06', '07', '08', '09', '10'],
  };

  it('al cargar, el pago es opcional y solo PAID u OWED', () => {
    expect(newPollaBetSchema.safeParse(bet).success).toBe(true);
    expect(newPollaBetSchema.safeParse({ ...bet, payment_status: 'OWED' }).success).toBe(true);
    expect(newPollaBetSchema.safeParse({ ...bet, payment_status: 'QR' }).success).toBe(false);
  });

  it('para marcar pagos hacen falta los tickets o la edición y el jugador', () => {
    expect(markPollaBetsPaidSchema.safeParse({ polla_bet_ids: [uuid(2)] }).success).toBe(true);
    expect(
      markPollaBetsPaidSchema.safeParse({ polla_edition_id: uuid(1), polla_user_id: uuid(3) })
        .success
    ).toBe(true);
    expect(markPollaBetsPaidSchema.safeParse({ polla_edition_id: uuid(1) }).success).toBe(false);
    expect(markPollaBetsPaidSchema.safeParse({}).success).toBe(false);
  });
});
