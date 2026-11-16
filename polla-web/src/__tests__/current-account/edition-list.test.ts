import { describe, expect, it } from 'vitest';
import { ApiError } from '@/lib/apiClient';
import { NETWORK_ERROR_MESSAGE, queryErrorMessage } from '@/lib/queryErrors';
import { chunk } from '@/lib/utils';
import { owedSummary } from '@/features/current-account/format';
import { EDITION_TOTALS_PER_REQUEST } from '@/features/current-account/fetchers';

describe('owedSummary: el Debe de la tarjeta de la edición, sin compensar', () => {
  it('lo que deben y lo que hay que pagarles, por separado', () =>
    expect(owedSummary(100, 30)).toBe('Debe $100,00 · Cobra $30,00'));
  it('la parte en 0 no se muestra', () => {
    expect(owedSummary(100, 0)).toBe('Debe $100,00');
    expect(owedSummary(0, 30)).toBe('Cobra $30,00');
  });
  it('con las dos en 0, "Debe $0,00"', () => expect(owedSummary(0, 0)).toBe('Debe $0,00'));
  it('acepta los montos como texto (NUMERIC de la base)', () =>
    expect(owedSummary('1500.5', '0.00')).toBe('Debe $1.500,50'));
});

describe('queryErrorMessage: el aviso cuando falla una consulta', () => {
  it('el motivo que manda la API', () =>
    expect(queryErrorMessage(new ApiError(500, { message: 'Se cayó la base' }))).toBe(
      'Se cayó la base'
    ));
  it('la sesión vencida no avisa (la maneja el apiClient)', () =>
    expect(queryErrorMessage(new ApiError(401, { message: 'Sesión expirada' }))).toBeNull());
  it('sin respuesta del servidor, que revise la conexión', () =>
    expect(queryErrorMessage(new TypeError('Failed to fetch'))).toBe(NETWORK_ERROR_MESSAGE));
});

describe('chunk: reportes de más de 60 ediciones en tandas', () => {
  it('parte en tandas del tamaño pedido', () =>
    expect(chunk([1, 2, 3, 4, 5], 2)).toEqual([[1, 2], [3, 4], [5]]));
  it('una lista vacía no hace pedidos', () => expect(chunk([], 60)).toEqual([]));
  it('130 ediciones son 3 pedidos (60, 60 y 10)', () => {
    const ids = Array.from({ length: 130 }, (_, i) => String(i));
    expect(chunk(ids, EDITION_TOTALS_PER_REQUEST).map((part) => part.length)).toEqual([60, 60, 10]);
  });
});
