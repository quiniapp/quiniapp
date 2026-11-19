import dayjs from 'dayjs';
import {
  groupFoldersIfAny,
  liquidationZipEntries as zipEntries,
  zipFolderName,
  zipRootFolder,
} from '@helper/functions/liquidationZip';
import { groupLiquidationLabel } from '@/lib/groupLiquidation';

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

/** `polla_liquidaciones_grupos_DD-MM-YYYY.zip` (`polla_plus_…` en una edición especial). */
export const groupLiquidationZipName = (p: { date: string; special?: boolean }) =>
  `${p.special ? 'polla_plus' : 'polla'}_liquidaciones_grupos_${fileDate(p.date)}.zip`;

/** `Grupo N - Nombre DD-MM-YYYY.ext` (sin el número, `Nombre DD-MM-YYYY.ext`). */
export const groupLiquidationFileName = (
  group: { number?: number; name: string },
  date: string,
  ext: 'pdf' | 'png'
) => `${zipFolderName(`${groupLiquidationLabel(group)} ${fileDate(date)}`)}.${ext}`;

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

/**
 * Nombres para compartir las imágenes sueltas (sin carpetas): el último
 * segmento de cada ruta; si se repite, se le antepone la carpeta que sigue a la
 * raíz (la edición) y, si todavía se repite, ` (n)` antes de la extensión.
 */
export const looseFileNames = (paths: string[]) => {
  const parts = paths.map((path) => path.split('/'));
  const base = parts.map((segments) => segments[segments.length - 1]);
  const count = (names: string[], name: string) => names.filter((n) => n === name).length;
  const named = base.map((name, i) =>
    count(base, name) > 1 && parts[i].length > 2 ? `${parts[i][1]} ${name}` : name
  );
  const seen = new Map<string, number>();
  return named.map((name) => {
    if (count(named, name) < 2) return name;
    const n = (seen.get(name) ?? 0) + 1;
    seen.set(name, n);
    if (n === 1) return name;
    const dot = name.lastIndexOf('.');
    return dot === -1 ? `${name} (${n})` : `${name.slice(0, dot)} (${n})${name.slice(dot)}`;
  });
};
