import { describe, expect, it } from 'vitest';
import {
  liquidatePollaGroupEditionSchema,
  liquidatePollaGroupEditionsSchema,
} from '@helper/polla/schemas/game.schema';
import {
  newPollaGroupWithAdminSchema,
  updatePollaUserSchema,
} from '@helper/polla/schemas/user.schema';
import {
  groupLiquidatable,
  groupLiquidationPercentage,
  groupsToSelectAll,
} from '@/lib/editionAccount';

const G1 = '11111111-1111-4111-8111-111111111111';
const G2 = '22222222-2222-4222-8222-222222222222';

const account = (
  over: Partial<{ cashiers_subtotal: number; expenses: number; admin_percentage: number }> = {}
) => ({
  polla_group_edition_account_id: 'a',
  polla_organization_id: 'o',
  polla_group_id: G1,
  polla_edition_id: 'e',
  group_name: 'G',
  cashiers_subtotal: 100,
  expenses: 0,
  base: 100,
  admin_percentage: 10,
  admin_commission: 10,
  adjustments: 0,
  paid: 0,
  total: 10,
  created_by: null,
  created_at: '',
  edited_at: '',
  collections: 0,
  payments: 0,
  ...over,
});

const preview = (
  id: string,
  over: Partial<Parameters<typeof groupsToSelectAll>[0][number]> = {}
) => ({
  polla_group_id: id,
  cashiers_subtotal: 100,
  expenses: 0,
  pending_cashiers: [],
  account: null,
  ...over,
});

describe('groupLiquidatable', () => {
  it('con la carga cerrada y sin pasadores pendientes', () => {
    expect(groupLiquidatable(preview(G1), false)).toBe(true);
    expect(groupLiquidatable(preview(G1), true)).toBe(false);
    expect(
      groupLiquidatable(
        preview(G1, { pending_cashiers: [{ polla_user_id: 'p', name: 'P', number: 1 }] }),
        false
      )
    ).toBe(false);
  });
});

describe('groupsToSelectAll', () => {
  it('tilda los sin liquidar y los desactualizados, no los liquidados al día ni los pendientes', () => {
    const ids = groupsToSelectAll(
      [
        preview('sin'),
        preview('al-dia', { account: account() }),
        preview('viejo', { cashiers_subtotal: 150, account: account() }),
        preview('pend', { pending_cashiers: [{ polla_user_id: 'p', name: 'P', number: 1 }] }),
      ],
      false
    );
    expect(ids).toEqual(['sin', 'viejo']);
  });
  it('con la carga abierta no tilda ninguno', () => {
    expect(groupsToSelectAll([preview('sin')], true)).toEqual([]);
  });
});

describe('groupLiquidationPercentage', () => {
  it('el del admin, fijo; si no, el de la última liquidación o vacío, a mano', () => {
    expect(groupLiquidationPercentage(12.5, null)).toEqual({ value: '12.5', locked: true });
    expect(groupLiquidationPercentage('15.00', account())).toEqual({ value: '15', locked: true });
    expect(groupLiquidationPercentage(null, account({ admin_percentage: 8 }))).toEqual({
      value: '8',
      locked: false,
    });
    expect(groupLiquidationPercentage(undefined, null)).toEqual({ value: '', locked: false });
  });
});

describe('schemas del % del admin', () => {
  const admin = { name: 'A', username: 'adm1', password: '123456' };

  it('el alta del grupo acepta el % (opcional, 0 a 100)', () => {
    const base = { group: { name: 'G' } };
    expect(newPollaGroupWithAdminSchema.safeParse({ ...base, admin }).success).toBe(true);
    expect(
      newPollaGroupWithAdminSchema.safeParse({ ...base, admin: { ...admin, admin_percentage: 10 } })
        .success
    ).toBe(true);
    expect(
      newPollaGroupWithAdminSchema.safeParse({
        ...base,
        admin: { ...admin, admin_percentage: null },
      }).success
    ).toBe(true);
    const over = newPollaGroupWithAdminSchema.safeParse({
      ...base,
      admin: { ...admin, admin_percentage: 101 },
    });
    expect(over.success).toBe(false);
    expect(over.error?.issues[0]?.message).toBe('El porcentaje va de 0 a 100');
    expect(
      newPollaGroupWithAdminSchema.safeParse({
        ...base,
        admin: { ...admin, admin_percentage: Number.NaN },
      }).success
    ).toBe(false);
  });

  it('editar el usuario acepta el % o null', () => {
    expect(updatePollaUserSchema.safeParse({ name: 'A', admin_percentage: 7.5 }).success).toBe(
      true
    );
    expect(updatePollaUserSchema.safeParse({ name: 'A', admin_percentage: null }).success).toBe(
      true
    );
    expect(updatePollaUserSchema.safeParse({ name: 'A', admin_percentage: -1 }).success).toBe(
      false
    );
  });

  it('liquidar: el % es opcional (si el admin tiene el suyo, manda ese)', () => {
    expect(liquidatePollaGroupEditionSchema.safeParse({ polla_group_id: G1 }).success).toBe(true);
    expect(
      liquidatePollaGroupEditionSchema.safeParse({ polla_group_id: G1, admin_percentage: 150 })
        .success
    ).toBe(false);
  });

  it('liquidar varios: al menos uno y sin repetidos', () => {
    expect(
      liquidatePollaGroupEditionsSchema.safeParse({
        groups: [{ polla_group_id: G1 }, { polla_group_id: G2, admin_percentage: 10 }],
      }).success
    ).toBe(true);
    expect(liquidatePollaGroupEditionsSchema.safeParse({ groups: [] }).success).toBe(false);
    const dup = liquidatePollaGroupEditionsSchema.safeParse({
      groups: [{ polla_group_id: G1 }, { polla_group_id: G1 }],
    });
    expect(dup.success).toBe(false);
    expect(dup.error?.issues[0]?.message).toBe('Hay un grupo repetido');
  });
});
