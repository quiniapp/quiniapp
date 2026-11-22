import { describe, expect, it } from 'vitest';
// El ZIP de QuiniApp usa las mismas rutas que la Polla (`@helper/functions/liquidationZip`).
import {
  quinielaLiquidationPdfName,
  quinielaLiquidationZipEntries,
  quinielaLiquidationZipName,
} from '@/lib/liquidationZip';

const D = '2026-11-15';

describe('ZIP de liquidaciones de QuiniApp', () => {
  it('nombre del ZIP y de cada PDF, con prefijo del juego y fecha', () => {
    expect(quinielaLiquidationZipName(D)).toBe('quiniela_liquidaciones_15-11-2026.zip');
    expect(quinielaLiquidationPdfName(6, 'Laura', D)).toBe('quiniela_6 Laura 15-11-2026.pdf');
    expect(quinielaLiquidationPdfName(null, 'A/B', D)).toBe('quiniela_A_B 15-11-2026.pdf');
  });

  it('raíz, carpetas por grupo (por nombre) con fecha y Sin grupo al final', () => {
    const zipName = quinielaLiquidationZipName(D);
    const paths = quinielaLiquidationZipEntries(
      [
        { fileName: 'c.pdf', date: D },
        { fileName: 'b.pdf', groupName: 'Norte', date: D },
        { fileName: 'a.pdf', groupName: 'Leo', date: D },
      ],
      zipName
    ).map((e) => e.path);
    expect(paths).toEqual([
      'quiniela_liquidaciones_15-11-2026/Leo 15-11-2026/a.pdf',
      'quiniela_liquidaciones_15-11-2026/Norte 15-11-2026/b.pdf',
      'quiniela_liquidaciones_15-11-2026/Sin grupo 15-11-2026/c.pdf',
    ]);
  });

  it('sin grupos: los PDF en la raíz', () => {
    const paths = quinielaLiquidationZipEntries(
      [{ fileName: 'a.pdf', date: D }],
      quinielaLiquidationZipName(D)
    ).map((e) => e.path);
    expect(paths).toEqual(['quiniela_liquidaciones_15-11-2026/a.pdf']);
  });
});
