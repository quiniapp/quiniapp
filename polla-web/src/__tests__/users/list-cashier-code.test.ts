import { describe, expect, it } from 'vitest';
import { POLLA_USER_TYPE } from '@helper/polla/types/user.type';
import { pollaListCashierCode } from '@/lib/pollaUsers';

const player = { user_type: POLLA_USER_TYPE.PLAYER, cashier_code: '10-938' };

describe('pollaListCashierCode', () => {
  it('superiores ven el código del pasador del jugador', () => {
    for (const role of [
      POLLA_USER_TYPE.OWNER,
      POLLA_USER_TYPE.CAPITALIST,
      POLLA_USER_TYPE.SUPERADMIN,
      POLLA_USER_TYPE.ASSISTANT,
      POLLA_USER_TYPE.ADMIN,
    ]) {
      expect(pollaListCashierCode(player, role)).toBe('10-938');
    }
  });
  it('pasador, jugador o sin rol no lo ven', () => {
    expect(pollaListCashierCode(player, POLLA_USER_TYPE.CASHIER)).toBeNull();
    expect(pollaListCashierCode(player, POLLA_USER_TYPE.PLAYER)).toBeNull();
    expect(pollaListCashierCode(player, null)).toBeNull();
  });
  it('solo jugadores', () => {
    expect(
      pollaListCashierCode(
        { user_type: POLLA_USER_TYPE.CASHIER, cashier_code: '10-938' },
        POLLA_USER_TYPE.OWNER
      )
    ).toBeNull();
  });
  it('sin código no muestra nada', () => {
    expect(
      pollaListCashierCode({ ...player, cashier_code: null }, POLLA_USER_TYPE.OWNER)
    ).toBeNull();
    expect(pollaListCashierCode({ ...player, cashier_code: '' }, POLLA_USER_TYPE.OWNER)).toBeNull();
    expect(
      pollaListCashierCode({ user_type: POLLA_USER_TYPE.PLAYER }, POLLA_USER_TYPE.OWNER)
    ).toBeNull();
  });
});
