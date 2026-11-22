import { describe, expect, it } from 'vitest';
import { unzipSync, strFromU8 } from 'fflate';
import {
  groupFoldersIfAny,
  liquidationZipEntries as helperZipEntries,
  type LiquidationZipItem,
  zipRootFolder,
} from '@helper/functions/liquidationZip';
import {
  editionZipFolder,
  groupFolderName,
  liquidationZipEntries,
  liquidationZipName,
  liquidationZipPdfName,
  MAX_SHARE_BYTES,
  shouldZipImages,
  zipFiles,
  zipFolderName,
} from '@/lib/liquidationZip';

const D = '2026-11-15';

describe('zipFolderName', () => {
  it('saca los caracteres prohibidos, deja los espacios y recorta puntos y espacios finales', () => {
    expect(zipFolderName('Semana 9/11: "A"')).toBe('Semana 9_11_ _A_');
    expect(zipFolderName('  Grupo.  ')).toBe('Grupo');
  });
});

describe('groupFolderName', () => {
  it('número, nombre y fecha, o Sin grupo con fecha', () => {
    expect(groupFolderName({ number: 1, name: 'Leo' }, D)).toBe('Grupo 1 - Leo 15-11-2026');
    expect(groupFolderName({ number: 4, name: 'Norte/Sur' }, D)).toBe(
      'Grupo 4 - Norte_Sur 15-11-2026'
    );
    expect(groupFolderName(undefined, D)).toBe('Sin grupo 15-11-2026');
  });
});

describe('liquidationZipName', () => {
  it('una edición (regular y plus), varias, un día y el filtro de grupo', () => {
    expect(liquidationZipName({ kind: 'edition', date: D })).toBe(
      'polla_liquidaciones_15-11-2026.zip'
    );
    expect(liquidationZipName({ kind: 'edition', date: D, special: true }, { number: 2 })).toBe(
      'polla_plus_liquidaciones_15-11-2026_Grupo_2.zip'
    );
    expect(liquidationZipName({ kind: 'range', from: '2026-11-01', to: D })).toBe(
      'polla_liquidaciones_01-11-2026_al_15-11-2026.zip'
    );
    expect(liquidationZipName({ kind: 'range', from: '2026-11-01', to: D }, 'none')).toBe(
      'polla_liquidaciones_01-11-2026_al_15-11-2026_Sin_grupo.zip'
    );
    expect(liquidationZipName({ kind: 'day', date: '2026-11-05' }, { number: 10 })).toBe(
      'polla_liquidaciones_05-11-2026_Grupo_10.zip'
    );
  });
  it('la carpeta raíz se llama como el ZIP', () => {
    expect(zipRootFolder('polla_liquidaciones_15-11-2026.zip')).toBe(
      'polla_liquidaciones_15-11-2026'
    );
  });
});

describe('editionZipFolder', () => {
  it('fecha y título; el título largo se corta a 24 con …', () => {
    const long = editionZipFolder(
      '2026-11-08',
      'Especial · 1 - Nacional · Nocturna, 2 - Provincia · Nocturna'
    );
    expect(long.startsWith('2026-11-08 Especial · 1 - Nacional')).toBe(true);
    expect(long.endsWith('…')).toBe(true);
    expect(long.length).toBeLessThanOrEqual('2026-11-08 '.length + 25);
    expect(editionZipFolder('2026-11-01', '1 día')).toBe('2026-11-01 1 día');
  });
  it('sanea el título y, sin título, queda la fecha', () => {
    expect(editionZipFolder('2026-11-08', 'A/B')).toBe('2026-11-08 A_B');
    expect(editionZipFolder('2026-11-08', '')).toBe('2026-11-08');
  });
});

describe('liquidationZipPdfName', () => {
  it('prefijo del juego, código, nombre y fecha; sin código, caracteres prohibidos y sin nombre', () => {
    expect(liquidationZipPdfName('1-6', 'Laura', D)).toBe('polla_1-6 Laura 15-11-2026.pdf');
    expect(liquidationZipPdfName('', 'Ana', D)).toBe('polla_Ana 15-11-2026.pdf');
    expect(liquidationZipPdfName('2-5', 'Ana/Beto: "x"', D)).toBe(
      'polla_2-5 Ana_Beto_ _x_ 15-11-2026.pdf'
    );
    expect(liquidationZipPdfName('3-1', null, D)).toBe('polla_3-1 Pasador 15-11-2026.pdf');
  });

  it('edición especial: polla_plus_, como el ZIP', () => {
    expect(liquidationZipPdfName('1-6', 'Laura', D, true)).toBe(
      'polla_plus_1-6 Laura 15-11-2026.pdf'
    );
  });
});

describe('liquidationZipEntries', () => {
  const g2 = { number: 2, name: 'Centro' };
  const g10 = { number: 10, name: 'Norte' };
  const root = 'polla_liquidaciones_15-11-2026';

  it('una edición: raíz, grupos por número con fecha y Sin grupo al final', () => {
    const paths = liquidationZipEntries(
      [
        { fileName: 'c.pdf', date: D },
        { fileName: 'b.pdf', group: g10, date: D },
        { fileName: 'a.pdf', group: g2, date: D },
      ],
      root
    ).map((e) => e.path);
    expect(paths).toEqual([
      `${root}/Grupo 2 - Centro 15-11-2026/a.pdf`,
      `${root}/Grupo 10 - Norte 15-11-2026/b.pdf`,
      `${root}/Sin grupo 15-11-2026/c.pdf`,
    ]);
  });

  it('sin ningún grupo: los PDF van directo en la raíz', () => {
    const paths = liquidationZipEntries(
      [
        { fileName: 'a.pdf', date: D },
        { fileName: 'b.pdf', date: D },
      ],
      root
    ).map((e) => e.path);
    expect(paths).toEqual([`${root}/a.pdf`, `${root}/b.pdf`]);
  });

  it('devuelve la hoja original de cada ruta', () => {
    const sheet = { fileName: 'a.pdf', group: g2, date: D, extra: 7 };
    const [entry] = liquidationZipEntries([sheet], root);
    expect(entry.item).toBe(sheet);
  });

  it('varias ediciones: edición/grupo con la fecha de cada una; mismo título no se mezcla', () => {
    const paths = liquidationZipEntries(
      [
        { fileName: 'x.pdf', group: g2, date: D, edition: { key: 'e1', folder: 'Especial' } },
        {
          fileName: 'x.pdf',
          group: g2,
          date: '2026-11-22',
          edition: { key: 'e2', folder: 'Especial' },
        },
        { fileName: 'y.pdf', date: D, edition: { key: 'e3', folder: '1 día' } },
      ],
      'polla_liquidaciones_01-11-2026_al_30-11-2026'
    ).map((e) => e.path);
    expect(paths).toEqual([
      'polla_liquidaciones_01-11-2026_al_30-11-2026/Especial/Grupo 2 - Centro 15-11-2026/x.pdf',
      'polla_liquidaciones_01-11-2026_al_30-11-2026/Especial (2)/Grupo 2 - Centro 22-11-2026/x.pdf',
      'polla_liquidaciones_01-11-2026_al_30-11-2026/1 día/Sin grupo 15-11-2026/y.pdf',
    ]);
  });

  it('carpetas de edición distintas sin distinguir mayúsculas ni choques con (2)', () => {
    const folders = (list: { key: string; folder: string }[]) =>
      liquidationZipEntries(
        list.map((edition) => ({ fileName: 'a.pdf', date: D, edition })),
        root
      ).map((e) => e.path.split('/')[1].toLowerCase());
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
    const paths = liquidationZipEntries(
      [
        { fileName: 'p.pdf', group: g2, date: D },
        { fileName: 'p.pdf', group: g2, date: D },
      ],
      root
    ).map((e) => e.path);
    expect(paths).toEqual([
      `${root}/Grupo 2 - Centro 15-11-2026/p.pdf`,
      `${root}/Grupo 2 - Centro 15-11-2026/p (2).pdf`,
    ]);
  });

  // 185 + los 6 del prefijo `polla_` del archivo: lo que queda de los 260 de Windows es para
  // la carpeta de destino de "Extraer todo".
  it('peor caso de varias ediciones: la ruta adentro del ZIP no pasa los 191 caracteres', () => {
    const zipName = liquidationZipName(
      { kind: 'range', from: '2026-11-01', to: '2026-11-30' },
      { number: 10 }
    );
    const [{ path }] = liquidationZipEntries(
      [
        {
          fileName: liquidationZipPdfName('10-150', 'M'.repeat(30), D),
          group: { number: 10, name: 'G'.repeat(20) },
          date: D,
          edition: {
            key: 'e1',
            folder: editionZipFolder(
              '2026-11-02',
              'Especial · 1 - Nacional · Nocturna, 2 - Provincia'
            ),
          },
        },
      ],
      zipRootFolder(zipName)
    );
    expect(path.length).toBeLessThanOrEqual(191);
  });
});

describe('helper: groupFoldersIfAny y rutas sin raíz', () => {
  it('sin grupos no agrega carpetas; con alguno, los demás van a la de sin grupo', () => {
    const none = groupFoldersIfAny<LiquidationZipItem>([{ fileName: 'a.pdf' }], () => 'Sin grupo');
    expect(none[0].group).toBeUndefined();
    const some = groupFoldersIfAny(
      [{ fileName: 'a.pdf' }, { fileName: 'b.pdf', group: { folder: 'Leo', order: 0 } }],
      () => 'Sin grupo'
    );
    expect(helperZipEntries(some).map((e) => e.path)).toEqual(['Leo/b.pdf', 'Sin grupo/a.pdf']);
  });
});

describe('zipFiles', () => {
  it('arma un ZIP que se abre con las mismas rutas (con ñ) y los mismos bytes', async () => {
    const pdf = new Uint8Array([37, 80, 68, 70, 1, 2, 3]);
    const blob = await zipFiles([
      { path: 'raiz/Grupo 3 - Peñarol 15-11-2026/a.pdf', data: pdf },
      { path: 'raiz/Sin grupo 15-11-2026/b.pdf', data: new TextEncoder().encode('hola') },
    ]);
    expect(blob.type).toBe('application/zip');
    const files = unzipSync(new Uint8Array(await blob.arrayBuffer()));
    expect(Object.keys(files).sort()).toEqual([
      'raiz/Grupo 3 - Peñarol 15-11-2026/a.pdf',
      'raiz/Sin grupo 15-11-2026/b.pdf',
    ]);
    expect(files['raiz/Grupo 3 - Peñarol 15-11-2026/a.pdf']).toEqual(pdf);
    expect(strFromU8(files['raiz/Sin grupo 15-11-2026/b.pdf'])).toBe('hola');
  });
});

describe('shouldZipImages: el límite de la hoja de compartir', () => {
  const blob = (size: number) => ({ size });

  it('hasta 10 archivos y 50 MB se comparten sueltos', () => {
    expect(shouldZipImages(Array.from({ length: 10 }, () => blob(1000)))).toBe(false);
    expect(shouldZipImages([blob(MAX_SHARE_BYTES)])).toBe(false);
  });

  it('más de 10 archivos va directo al ZIP', () => {
    expect(shouldZipImages(Array.from({ length: 11 }, () => blob(1000)))).toBe(true);
  });

  it('más de 50 MB en total va directo al ZIP', () => {
    expect(shouldZipImages([blob(MAX_SHARE_BYTES), blob(1)])).toBe(true);
  });
});
