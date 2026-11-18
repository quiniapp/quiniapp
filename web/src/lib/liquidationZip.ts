import dayjs from 'dayjs';
import {
  groupFoldersIfAny,
  liquidationZipEntries as zipEntries,
  zipRootFolder,
} from '@helper/functions/liquidationZip';

/**
 * ZIP de liquidaciones de QuiniApp, con las mismas reglas que la Polla
 * (`@helper/functions/liquidationZip`):
 *
 * `quiniela_liquidaciones_15-11-2026.zip`
 * └ `quiniela_liquidaciones_15-11-2026/Leo 15-11-2026/6 Laura 15-11-2026.pdf`
 *
 * Los grupos son sub-organizaciones sin número: la carpeta es el nombre y la
 * fecha. Si ningún pasador tiene grupo, los PDF van directo en la raíz.
 */

export const NO_GROUP_FOLDER = 'Sin grupo';

/** `DD-MM-YYYY` de una fecha `YYYY-MM-DD`. */
export const fileDate = (date: string) => dayjs(date).format('DD-MM-YYYY');

/** `quiniela_liquidaciones_DD-MM-YYYY.zip`. */
export const quinielaLiquidationZipName = (date: string) =>
  `quiniela_liquidaciones_${fileDate(date)}.zip`;

/** `{número} {nombre} {DD-MM-YYYY}.pdf` de un pasador. */
export const quinielaLiquidationPdfName = (
  userNumber: number | string | null | undefined,
  userName: string | null | undefined,
  date: string
) => {
  const name = (userName ?? '').replace(/[\\/:*?"<>|]/g, '_').trim() || 'Pasador';
  const number = userNumber === null || userNumber === undefined ? '' : `${userNumber} `;
  return `${number}${name} ${fileDate(date)}.pdf`;
};

export interface QuinielaZipSheet {
  fileName: string;
  /** Nombre del grupo; sin grupo → `Sin grupo`. */
  groupName?: string;
  /** `YYYY-MM-DD`: va en la carpeta del grupo. */
  date: string;
}

/** Ruta de cada PDF: `raíz/[grupo fecha/]archivo`, grupos por nombre y "Sin grupo" al final. */
export const quinielaLiquidationZipEntries = <T extends QuinielaZipSheet>(
  sheets: T[],
  zipName: string
) => {
  const order = new Map(
    [...new Set(sheets.map((s) => s.groupName).filter((name): name is string => Boolean(name)))]
      .sort((a, b) => a.localeCompare(b, 'es'))
      .map((name, index) => [name, index])
  );
  return zipEntries(
    groupFoldersIfAny(
      sheets.map((sheet) => ({
        sheet,
        fileName: sheet.fileName,
        group: sheet.groupName
          ? {
              folder: `${sheet.groupName} ${fileDate(sheet.date)}`,
              order: order.get(sheet.groupName) ?? 0,
            }
          : undefined,
      })),
      (item) => `${NO_GROUP_FOLDER} ${fileDate(item.sheet.date)}`
    ),
    zipRootFolder(zipName)
  ).map(({ path, item }) => ({ path, item: item.sheet }));
};

/** ZIP comprimido; fflate se carga recién acá. Las rutas tienen que ser únicas. */
export const zipFiles = async (files: { path: string; data: Uint8Array }[]) => {
  const { zipSync } = await import('fflate');
  const out = zipSync(Object.fromEntries(files.map((f) => [f.path, f.data])), { level: 6 });
  return new Blob([out], { type: 'application/zip' });
};
