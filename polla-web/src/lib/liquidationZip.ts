import dayjs from 'dayjs';
import {
  groupFoldersIfAny,
  liquidationZipEntries as zipEntries,
  zipFolderName,
  zipRootFolder,
} from '@helper/functions/liquidationZip';

/**
 * Reglas del ZIP de liquidaciones de la Polla: nombres con fecha, carpetas por
 * edición y grupo, y armado del archivo. Las rutas salen de
 * `@helper/functions/liquidationZip` (las comparte QuiniApp). Sin DOM.
 *
 * `polla_liquidaciones_15-11-2026.zip`
 * └ `polla_liquidaciones_15-11-2026/Grupo 1 - Leo 15-11-2026/1-6 Laura 15-11-2026.pdf`
 */

export { zipFolderName, zipRootFolder };

export const NO_GROUP_FOLDER = 'Sin grupo';

export type ZipGroup = { number: number; name: string };
/** Filtro de grupo del exporte: un grupo, "Sin grupo" o ninguno. */
export type ZipGroupFilter = { number: number } | 'none' | undefined;
export type LiquidationZipScope =
  /** Una edición: `date` es el de su liquidación; `special` → `polla_plus_…`. */
  | { kind: 'edition'; date: string; special?: boolean }
  | { kind: 'range'; from: string; to: string } // YYYY-MM-DD
  | { kind: 'day'; date: string }; // YYYY-MM-DD

/** `DD-MM-YYYY` de una fecha `YYYY-MM-DD` (o un timestamp). */
export const fileDate = (date: string) => dayjs(date).format('DD-MM-YYYY');

const FOLDER_TITLE_MAX = 24;

/**
 * Carpeta de una edición en "Varias ediciones": `YYYY-MM-DD <título>`, título
 * de hasta 24 caracteres (con la raíz y las fechas, la ruta tiene que entrar en
 * los 260 de Windows, que "Extraer todo" ya gasta en la carpeta de destino).
 */
export const editionZipFolder = (startDate: string, title: string) => {
  const clean = zipFolderName(title);
  if (!clean) return startDate;
  const short =
    clean.length > FOLDER_TITLE_MAX
      ? `${clean.slice(0, FOLDER_TITLE_MAX).replace(/[. ]+$/, '')}…`
      : clean;
  return `${startDate} ${short}`;
};

/** `{código} {nombre} {DD-MM-YYYY}.pdf` de un pasador dentro del ZIP. */
export const liquidationZipPdfName = (
  cashierCode: string,
  userName: string | null | undefined,
  date: string
) => {
  const name = (userName ?? '').replace(/[\\/:*?"<>|]/g, '_').trim() || 'Pasador';
  return `${cashierCode ? `${cashierCode} ` : ''}${name} ${fileDate(date)}.pdf`;
};

/** `Grupo N - Nombre DD-MM-YYYY` o `Sin grupo DD-MM-YYYY`. */
export const groupFolderName = (group: ZipGroup | undefined, date: string) =>
  zipFolderName(
    `${group ? `Grupo ${group.number} - ${group.name}` : NO_GROUP_FOLDER} ${fileDate(date)}`
  );

/** Nombre del ZIP (y de su carpeta raíz) según el alcance y el filtro de grupo. */
export const liquidationZipName = (scope: LiquidationZipScope, group?: ZipGroupFilter) => {
  const prefix = scope.kind === 'edition' && scope.special ? 'polla_plus' : 'polla';
  const dates =
    scope.kind === 'range'
      ? `${fileDate(scope.from)}_al_${fileDate(scope.to)}`
      : fileDate(scope.date);
  const suffix = group === 'none' ? '_Sin_grupo' : group ? `_Grupo_${group.number}` : '';
  return `${prefix}_liquidaciones_${dates}${suffix}.zip`;
};

/** Una hoja del ZIP: archivo, grupo, fecha (de su liquidación) y, en varias, edición. */
export interface LiquidationZipSheet {
  fileName: string;
  group?: ZipGroup;
  /** `YYYY-MM-DD`: va en la carpeta del grupo. */
  date: string;
  edition?: { key: string; folder: string };
}

/**
 * Ruta de cada archivo: `raíz/[edición/][grupo fecha/]archivo`, grupos por
 * número y "Sin grupo" al final. Si ninguna hoja tiene grupo, sin carpetas de
 * grupo.
 */
export const liquidationZipEntries = <T extends LiquidationZipSheet>(items: T[], root: string) =>
  zipEntries(
    groupFoldersIfAny(
      items.map((item) => ({
        sheet: item,
        fileName: item.fileName,
        edition: item.edition,
        group: item.group
          ? { folder: groupFolderName(item.group, item.date), order: item.group.number }
          : undefined,
      })),
      (item) => groupFolderName(undefined, item.sheet.date)
    ),
    root
  ).map(({ path, item }) => ({ path, item: item.sheet }));

/**
 * Arma el ZIP comprimido (el PDF de jsPDF sale sin comprimir); fflate se carga
 * recién acá. Las rutas tienen que ser únicas (`liquidationZipEntries`).
 */
export const zipFiles = async (files: { path: string; data: Uint8Array }[]) => {
  const { zipSync } = await import('fflate');
  const out = zipSync(Object.fromEntries(files.map((f) => [f.path, f.data])), { level: 6 });
  return new Blob([out], { type: 'application/zip' });
};
