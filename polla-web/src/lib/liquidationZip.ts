import dayjs from 'dayjs';
import { editionFileTag } from '@/lib/editionAccount';

/**
 * Reglas del ZIP de liquidaciones: carpetas por edición y grupo, nombres sin
 * colisiones y armado del archivo. Sin dependencias del DOM.
 */

export const NO_GROUP_FOLDER = 'Sin grupo';

export type ZipGroup = { number: number; name: string };
/** Filtro de grupo del exporte: un grupo, "Sin grupo" o ninguno. */
export type ZipGroupFilter = { number: number } | 'none' | undefined;
export type LiquidationZipScope =
  | { kind: 'edition'; title: string }
  | { kind: 'range'; from: string; to: string } // YYYY-MM-DD
  | { kind: 'day'; date: string }; // YYYY-MM-DD

export interface LiquidationZipItem {
  fileName: string;
  group?: ZipGroup;
  /** Solo en varias ediciones; key distingue ediciones con el mismo título. */
  edition?: { key: string; folder: string };
}

/** Nombre apto para carpeta: sin caracteres prohibidos ni puntos/espacios al final. */
export const zipFolderName = (text: string) =>
  text
    .replace(/[\\/:*?"<>|]/g, '_')
    .trim()
    .replace(/[. ]+$/, '');

const FOLDER_TITLE_MAX = 40;

/** Carpeta de una edición en "Varias ediciones": `YYYY-MM-DD <título>`, título de hasta 40 caracteres. */
export const editionZipFolder = (startDate: string, title: string) => {
  const clean = zipFolderName(title);
  if (!clean) return startDate;
  const short =
    clean.length > FOLDER_TITLE_MAX
      ? `${clean.slice(0, FOLDER_TITLE_MAX).replace(/[. ]+$/, '')}…`
      : clean;
  return `${startDate} ${short}`;
};

/** `{código} {nombre}.pdf` de un pasador dentro del ZIP. */
export const liquidationZipPdfName = (cashierCode: string, userName: string | null | undefined) => {
  const name = (userName ?? '').replace(/[\\/:*?"<>|]/g, '_').trim() || 'Pasador';
  return `${cashierCode ? `${cashierCode} ` : ''}${name}.pdf`;
};

export const groupFolderName = (group?: ZipGroup) =>
  group ? zipFolderName(`Grupo ${group.number} - ${group.name}`) : NO_GROUP_FOLDER;

/** Nombre del ZIP según el alcance y el filtro de grupo. */
export const liquidationZipName = (scope: LiquidationZipScope, group?: ZipGroupFilter) => {
  const fmt = (date: string) => dayjs(date).format('DD-MM-YYYY');
  const base =
    scope.kind === 'edition'
      ? editionFileTag(scope.title)
      : scope.kind === 'range'
        ? `${fmt(scope.from)}_al_${fmt(scope.to)}`
        : fmt(scope.date);
  const suffix = group === 'none' ? '_Sin_grupo' : group ? `_Grupo_${group.number}` : '';
  return `polla_Liquidaciones_${base}${suffix}.zip`;
};

/** Agrega " (n)" antes de la extensión. */
const withCounter = (path: string, n: number) => {
  const dot = path.lastIndexOf('.');
  const slash = path.lastIndexOf('/');
  return dot > slash ? `${path.slice(0, dot)} (${n})${path.slice(dot)}` : `${path} (${n})`;
};

/** Ruta dentro del ZIP de cada archivo: [edición/]grupo/archivo, sin repetidos. */
export const liquidationZipEntries = <T extends LiquidationZipItem>(items: T[]) => {
  const editionOrder = new Map<string, number>();
  items.forEach((item) => {
    if (item.edition && !editionOrder.has(item.edition.key)) {
      editionOrder.set(item.edition.key, editionOrder.size);
    }
  });
  const rank = (item: T) => (item.edition ? (editionOrder.get(item.edition.key) ?? 0) : 0);
  const groupRank = (item: T) => item.group?.number ?? Number.POSITIVE_INFINITY;

  const sorted = items
    .map((item, index) => ({ item, index }))
    .sort((a, b) => {
      const byEdition = rank(a.item) - rank(b.item);
      if (byEdition !== 0) return byEdition;
      if (groupRank(a.item) !== groupRank(b.item))
        return groupRank(a.item) < groupRank(b.item) ? -1 : 1;
      return a.index - b.index;
    });

  // Carpeta de edición única por key, sin distinguir mayúsculas: si ya está
  // tomada lleva (2), (3)…
  const folderByKey = new Map<string, string>();
  const takenFolders = new Set<string>();
  const editionFolder = (edition: { key: string; folder: string }) => {
    const known = folderByKey.get(edition.key);
    if (known !== undefined) return known;
    const base = zipFolderName(edition.folder) || 'Edición';
    let folder = base;
    for (let n = 2; takenFolders.has(folder.toLowerCase()); n += 1) folder = `${base} (${n})`;
    takenFolders.add(folder.toLowerCase());
    folderByKey.set(edition.key, folder);
    return folder;
  };

  const used = new Set<string>();
  return sorted.map(({ item }) => {
    const prefix = item.edition ? `${editionFolder(item.edition)}/` : '';
    const base = `${prefix}${groupFolderName(item.group)}/${item.fileName}`;
    let path = base;
    for (let n = 2; used.has(path); n += 1) path = withCounter(base, n);
    used.add(path);
    return { path, item };
  });
};

/**
 * Arma el ZIP comprimido (el PDF de jsPDF sale sin comprimir); fflate se carga
 * recién acá. Las rutas tienen que ser únicas (`liquidationZipEntries`).
 */
export const zipFiles = async (files: { path: string; data: Uint8Array }[]) => {
  const { zipSync } = await import('fflate');
  const out = zipSync(Object.fromEntries(files.map((f) => [f.path, f.data])), { level: 6 });
  return new Blob([out], { type: 'application/zip' });
};
