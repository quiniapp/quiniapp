import { describe, expect, it } from 'vitest';
import {
  liquidateEditionAccountsSchema,
  newPollaOrgExpenseSchema,
  pollaAccountMovementSchema,
} from '@helper/polla/schemas/game.schema';

const UUID = '00000000-0000-0000-0000-000000000001';

describe('esquemas de la cuenta por edición', () => {
  it('un cobro negativo no pasa', () =>
    expect(
      pollaAccountMovementSchema.safeParse({ polla_user_id: UUID, type: 'COLLECTION', amount: -5 })
        .success
    ).toBe(false));
  it('un reclamo negativo pasa', () =>
    expect(
      pollaAccountMovementSchema.safeParse({ polla_user_id: UUID, type: 'CLAIM', amount: -5 })
        .success
    ).toBe(true));
  it('monto 0 no pasa', () =>
    expect(
      pollaAccountMovementSchema.safeParse({ polla_user_id: UUID, type: 'CLAIM', amount: 0 })
        .success
    ).toBe(false));
  it('liquidar pide al menos un pasador', () =>
    expect(liquidateEditionAccountsSchema.safeParse({ polla_user_ids: [] }).success).toBe(false));
  it('el gasto pide la edición', () =>
    expect(newPollaOrgExpenseSchema.safeParse({ name: 'Luz', amount: 10 }).success).toBe(false));
});
