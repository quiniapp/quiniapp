import { describe, expect, it } from 'vitest';
import { IPollaUserOption, POLLA_USER_TYPE } from '@helper/polla/types/user.type';
import { setPollaUserDisabledSchema } from '@helper/polla/schemas/user.schema';
import { describePollaUser, pollaUserBlockedText, pollaUserTypeLine } from '@/lib/pollaUsers';
import { repeatReasonLabel } from '@/lib/repeatReasons';

const player = (overrides: Partial<IPollaUserOption> = {}): IPollaUserOption => ({
  polla_user_id: '00000000-0000-0000-0000-000000000001',
  name: 'Ana',
  last_name: 'Gómez',
  username: 'ana',
  number: 4,
  user_type: POLLA_USER_TYPE.PLAYER,
  cashier_name: 'Pedro',
  cashier_number: 3,
  group_number: 2,
  is_street: false,
  disabled: false,
  cashier_disabled: false,
  ...overrides,
});

describe('usuario deshabilitado en los buscadores', () => {
  it('sin marca si puede entrar y jugar', () => {
    expect(pollaUserBlockedText(player())).toBeNull();
    expect(pollaUserTypeLine(player())).toBe('jugador de 2-3 · Pedro · ana');
  });

  it('el deshabilitado dice "deshabilitado"', () => {
    expect(pollaUserBlockedText(player({ disabled: true }))).toBe('deshabilitado');
    expect(describePollaUser(player({ disabled: true }))).toBe(
      'Ana Gómez · jugador de 2-3 · Pedro · deshabilitado'
    );
  });

  it('el jugador de un pasador deshabilitado dice "pasador deshabilitado"', () => {
    expect(pollaUserBlockedText(player({ cashier_disabled: true }))).toBe('pasador deshabilitado');
  });

  it('si están los dos, manda el suyo', () => {
    expect(pollaUserBlockedText(player({ disabled: true, cashier_disabled: true }))).toBe(
      'deshabilitado'
    );
  });

  it('el pasador deshabilitado', () => {
    const cashier = player({
      user_type: POLLA_USER_TYPE.CASHIER,
      cashier_name: 'Ana',
      disabled: true,
    });
    expect(pollaUserTypeLine(cashier)).toBe('pasador · ana · deshabilitado');
  });
});

describe('habilitar y deshabilitar', () => {
  it('el pedido lleva solo `disabled`', () => {
    expect(setPollaUserDisabledSchema.parse({ disabled: true, id: 'x' })).toEqual({
      disabled: true,
    });
    expect(setPollaUserDisabledSchema.safeParse({}).success).toBe(false);
  });

  it('repetir el ticket de un jugador frenado explica por qué', () => {
    expect(repeatReasonLabel('POLLA_CASHIER_DISABLED')).toBe('su pasador está deshabilitado');
  });
});
