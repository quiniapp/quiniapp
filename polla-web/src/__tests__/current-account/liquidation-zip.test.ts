import { describe, expect, it } from 'vitest';
import { unzipSync, strFromU8 } from 'fflate';
import {
  editionZipFolder,
  groupFolderName,
  liquidationZipEntries,
  liquidationZipName,
  liquidationZipPdfName,
  zipFiles,
  zipFolderName,
} from '@/lib/liquidationZip';

describe('zipFolderName', () => {
  it('saca los caracteres prohibidos, deja los espacios y recorta puntos y espacios finales', () => {
    expect(zipFolderName('Semana 9/11: "A"')).toBe('Semana 9_11_ _A_');
    expect(zipFolderName('  Grupo.  ')).toBe('Grupo');
  });
});

describe('groupFolderName', () => {
  it('número y nombre, o Sin grupo', () => {
    expect(groupFolderName({ number: 2, name: 'Centro' })).toBe('Grupo 2 - Centro');
    expect(groupFolderName({ number: 4, name: 'Norte/Sur' })).toBe('Grupo 4 - Norte_Sur');
    expect(groupFolderName(undefined)).toBe('Sin grupo');
  });
});

describe('liquidationZipName', () => {
  it('una edición, varias, un día y el filtro de grupo', () => {
    expect(liquidationZipName({ kind: 'edition', title: 'Semana 9/11' })).toBe(
      'polla_Liquidaciones_Edicion_Semana_9_11.zip'
    );
    expect(liquidationZipName({ kind: 'edition', title: 'Semana 9/11' }, { number: 2 })).toBe(
      'polla_Liquidaciones_Edicion_Semana_9_11_Grupo_2.zip'
    );
    expect(liquidationZipName({ kind: 'range', from: '2026-11-01', to: '2026-11-15' })).toBe(
      'polla_Liquidaciones_01-11-2026_al_15-11-2026.zip'
    );
    expect(liquidationZipName({ kind: 'day', date: '2026-11-05' }, 'none')).toBe(
      'polla_Liquidaciones_05-11-2026_Sin_grupo.zip'
    );
  });
});

describe('liquidationZipName (más casos)', () => {
  it('rango y día con filtro de grupo', () => {
    const range = { kind: 'range', from: '2026-11-01', to: '2026-11-15' } as const;
    expect(liquidationZipName(range, { number: 2 })).toBe(
      'polla_Liquidaciones_01-11-2026_al_15-11-2026_Grupo_2.zip'
    );
    expect(liquidationZipName(range, 'none')).toBe(
      'polla_Liquidaciones_01-11-2026_al_15-11-2026_Sin_grupo.zip'
    );
    expect(liquidationZipName({ kind: 'day', date: '2026-11-05' })).toBe(
      'polla_Liquidaciones_05-11-2026.zip'
    );
    expect(liquidationZipName({ kind: 'day', date: '2026-11-05' }, { number: 10 })).toBe(
      'polla_Liquidaciones_05-11-2026_Grupo_10.zip'
    );
  });
});

describe('editionZipFolder', () => {
  it('fecha y título; el título largo se corta a 40 con …', () => {
    const long = editionZipFolder(
      '2026-11-08',
      'Especial · 1 - Nacional · Nocturna, 2 - Provincia · Nocturna'
    );
    expect(long.startsWith('2026-11-08 Especial · 1 - Nacional')).toBe(true);
    expect(long.endsWith('…')).toBe(true);
    expect(long.length).toBeLessThanOrEqual('2026-11-08 '.length + 41);
    expect(editionZipFolder('2026-11-01', '1 día')).toBe('2026-11-01 1 día');
  });
  it('sanea el título y, sin título, queda la fecha', () => {
    expect(editionZipFolder('2026-11-08', 'A/B')).toBe('2026-11-08 A_B');
    expect(editionZipFolder('2026-11-08', '')).toBe('2026-11-08');
  });
});

describe('liquidationZipPdfName', () => {
  it('código y nombre, sin código, caracteres prohibidos y sin nombre', () => {
    expect(liquidationZipPdfName('10-15', 'María José Fernández')).toBe(
      '10-15 María José Fernández.pdf'
    );
    expect(liquidationZipPdfName('', 'Ana')).toBe('Ana.pdf');
    expect(liquidationZipPdfName('2-5', 'Ana/Beto: "x"')).toBe('2-5 Ana_Beto_ _x_.pdf');
    expect(liquidationZipPdfName('3-1', null)).toBe('3-1 Pasador.pdf');
  });
});

describe('liquidationZipEntries', () => {
  const g2 = { number: 2, name: 'Centro' };
  const g10 = { number: 10, name: 'Norte' };
  it('una edición: grupos por número y Sin grupo al final', () => {
    const paths = liquidationZipEntries([
      { fileName: 'c.pdf' },
      { fileName: 'b.pdf', group: g10 },
      { fileName: 'a.pdf', group: g2 },
    ]).map((e) => e.path);
    expect(paths).toEqual(['Grupo 2 - Centro/a.pdf', 'Grupo 10 - Norte/b.pdf', 'Sin grupo/c.pdf']);
  });
  it('varias ediciones: edición/grupo, en el orden de las ediciones; mismo título no se mezcla', () => {
    const paths = liquidationZipEntries([
      { fileName: 'x.pdf', group: g2, edition: { key: 'e1', folder: 'Especial' } },
      { fileName: 'x.pdf', group: g2, edition: { key: 'e2', folder: 'Especial' } },
      { fileName: 'y.pdf', edition: { key: 'e3', folder: '1 día' } },
    ]).map((e) => e.path);
    expect(paths).toEqual([
      'Especial/Grupo 2 - Centro/x.pdf',
      'Especial (2)/Grupo 2 - Centro/x.pdf',
      '1 día/Sin grupo/y.pdf',
    ]);
  });
  it('carpetas de edición distintas sin distinguir mayúsculas ni choques con (2)', () => {
    const folders = (list: { key: string; folder: string }[]) =>
      liquidationZipEntries(list.map((edition) => ({ fileName: 'a.pdf', edition }))).map((e) =>
        e.path.split('/')[0].toLowerCase()
      );
    const a = folders([
      { key: 'e1', folder: 'X' },
      { key: 'e2', folder: 'X' },
      { key: 'e3', folder: 'X (2)' },
    ]);
    expect(a[0]).toBe('x');
    expect(new Set(a).size).toBe(3);
    const b = folders([
      { key: 'e1', folder: 'Especial' },
      { key: 'e2', folder: 'especial' },
    ]);
    expect(new Set(b).size).toBe(2);
  });
  it('mismo archivo en la misma carpeta: el segundo lleva (2)', () => {
    const paths = liquidationZipEntries([
      { fileName: 'p.pdf', group: g2 },
      { fileName: 'p.pdf', group: g2 },
    ]).map((e) => e.path);
    expect(paths).toEqual(['Grupo 2 - Centro/p.pdf', 'Grupo 2 - Centro/p (2).pdf']);
  });
});

describe('zipFiles', () => {
  it('arma un ZIP que se abre con las mismas rutas (con ñ) y los mismos bytes', async () => {
    const pdf = new Uint8Array([37, 80, 68, 70, 1, 2, 3]);
    const blob = await zipFiles([
      { path: 'Grupo 3 - Peñarol/a.pdf', data: pdf },
      { path: 'Sin grupo/b.pdf', data: new TextEncoder().encode('hola') },
    ]);
    expect(blob.type).toBe('application/zip');
    const files = unzipSync(new Uint8Array(await blob.arrayBuffer()));
    expect(Object.keys(files).sort()).toEqual(['Grupo 3 - Peñarol/a.pdf', 'Sin grupo/b.pdf']);
    expect(files['Grupo 3 - Peñarol/a.pdf']).toEqual(pdf);
    expect(strFromU8(files['Sin grupo/b.pdf'])).toBe('hola');
  });
});
