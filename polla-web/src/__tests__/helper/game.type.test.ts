import { describe, expect, it } from 'vitest';
import { pollaTicketCashierCode, pollaTotalPool } from '@helper/polla/types/game.type';

describe('pollaTotalPool', () => {
  it('suma el pozo y el pozo sorpresa', () => {
    expect(pollaTotalPool({ pool_amount: 100000, surprise_pool_amount: 25000 })).toBe(125000);
  });

  it('toma el sorpresa vacío como 0 (ediciones viejas)', () => {
    expect(
      pollaTotalPool({ pool_amount: 50000, surprise_pool_amount: null as unknown as number })
    ).toBe(50000);
  });
});

describe('pollaTicketCashierCode', () => {
  it('saca grupo-pasador del ticket nuevo', () => {
    expect(pollaTicketCashierCode('10-20261105093015123-938-4', 938)).toBe('10-938');
  });

  it('usa el número del pasador en los tickets viejos', () => {
    expect(pollaTicketCashierCode('20261105093015123-7', 7)).toBe('7');
  });

  it('devuelve vacío sin número de pasador', () => {
    expect(pollaTicketCashierCode('20261105093015123', null)).toBe('');
  });
});
