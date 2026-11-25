import { describe, expect, it } from 'vitest';
import { groupFileLabel, pollaDailyReportName, pollaDailyReportTitle } from '@/lib/exportNames';
import { editionLiquidationDate } from '@/lib/editionAccount';

describe('pollaDailyReportName', () => {
  it('regular, especial y sin edición, siempre con fecha', () => {
    expect(pollaDailyReportName({ special: false, date: '2026-11-15' })).toBe(
      'Polla semanal parte diario 15-11-2026'
    );
    expect(pollaDailyReportName({ special: true, date: '2026-11-15' })).toBe(
      'Polla plus parte diario 15-11-2026'
    );
    expect(pollaDailyReportName({ date: '2026-11-15' })).toBe('Polla parte diario 15-11-2026');
  });

  it('rango, grupo y parte de grupos', () => {
    expect(pollaDailyReportName({ date: '2026-11-01', to: '2026-11-15' })).toBe(
      'Polla parte diario 01-11-2026 al 15-11-2026'
    );
    expect(pollaDailyReportName({ date: '2026-11-15', to: '2026-11-15' })).toBe(
      'Polla parte diario 15-11-2026'
    );
    expect(
      pollaDailyReportName({ special: false, date: '2026-11-15', group: 'Grupo 2 - Norte/Sur' })
    ).toBe('Polla semanal parte diario Grupo 2 - Norte_Sur 15-11-2026');
    expect(pollaDailyReportName({ special: true, date: '2026-11-15', groups: true })).toBe(
      'Polla plus parte diario grupos 15-11-2026'
    );
  });
});

describe('groupFileLabel', () => {
  it('con número, solo nombre o nada', () => {
    expect(groupFileLabel({ number: 2, name: 'Centro' })).toBe('Grupo 2 - Centro');
    expect(groupFileLabel({ name: 'Sin grupo' })).toBe('Sin grupo');
    expect(groupFileLabel(null)).toBeUndefined();
  });
});

describe('editionLiquidationDate', () => {
  const liq = (created_at: string) => ({
    liquidation: {
      polla_edition_liquidation_id: created_at,
      created_at,
      created_by_name: null,
      total: 0,
      kept_previous_tickets: false,
    },
  });

  it('la última liquidación de los pasadores', () => {
    expect(
      editionLiquidationDate(
        [liq('2026-11-14T15:00:00Z'), { liquidation: null }, liq('2026-11-16T12:00:00Z')],
        '2026-11-10T12:00:00Z'
      )
    ).toBe('2026-11-16');
  });

  it('sin liquidaciones: la marca de liquidada y, si no, hoy', () => {
    expect(editionLiquidationDate([{ liquidation: null }], '2026-11-10T12:00:00Z')).toBe(
      '2026-11-10'
    );
    expect(editionLiquidationDate([], null)).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });
});

describe('pollaDailyReportTitle', () => {
  it('lleva el juego', () => {
    expect(pollaDailyReportTitle({ special: false })).toBe('Polla semanal · Parte diario');
    expect(pollaDailyReportTitle({ special: true })).toBe('Polla plus · Parte diario');
    expect(pollaDailyReportTitle({})).toBe('Polla · Parte diario');
    expect(pollaDailyReportTitle({ special: true, groups: true })).toBe(
      'Polla plus · Parte diario de grupos'
    );
    expect(pollaDailyReportTitle({ groups: true })).toBe('Polla · Parte diario de grupos');
  });

  it('usa el punto medio y no un carácter de reemplazo', () => {
    const title = pollaDailyReportTitle({ special: true });
    expect(title).toContain('·');
    expect(title).not.toContain(String.fromCharCode(0xfffd));
  });
});
