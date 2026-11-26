import { describe, expect, it } from 'vitest';
import { resolveCurrentAccountDate } from '@/features/current-account/resolveDate';

const TODAY = '2026-11-24';

describe('resolveCurrentAccountDate', () => {
  it('la URL gana', () => {
    expect(resolveCurrentAccountDate('2026-11-20', { status: 'pending' }, TODAY)).toBe(
      '2026-11-20'
    );
  });
  it('mientras carga, null', () => {
    expect(resolveCurrentAccountDate(null, { status: 'pending' }, TODAY)).toBeNull();
  });
  it('última liquidación', () => {
    expect(resolveCurrentAccountDate(null, { status: 'success', date: '2026-11-22' }, TODAY)).toBe(
      '2026-11-22'
    );
  });
  it('sin liquidaciones → hoy', () => {
    expect(resolveCurrentAccountDate(null, { status: 'success', date: null }, TODAY)).toBe(TODAY);
  });
  it('error del endpoint → hoy', () => {
    expect(resolveCurrentAccountDate(null, { status: 'error' }, TODAY)).toBe(TODAY);
  });
});
