/**
 * Rutas del ZIP de liquidaciones, compartidas por Polla y QuiniApp:
 * `raíz/[edición/][grupo/]archivo`, sin repetidos. Puro y sin dependencias;
 * cada app arma sus nombres y comprime con fflate.
 */

/** Nombre apto para carpeta o archivo: sin `\/:*?"<>|` ni puntos/espacios al final. */
export const zipFolderName = (text: string) =>
  text
    .replace(/[\\/:*?"<>|]/g, '_')
    .trim()
    .replace(/[. ]+$/, '');

/** Carpeta de un grupo ya armada y su orden (sin grupo va al final). */
export interface ZipGroupFolder {
  folder: string;
  order: number;
}

export interface LiquidationZipItem {
  fileName: string;
  group?: ZipGroupFolder;
  /** Solo con varias ediciones; key distingue ediciones con el mismo título. */
  edition?: { key: string; folder: string };
}

/**
 * "Si existen grupos": si alguna hoja tiene grupo, las que no tienen van a la
 * carpeta de sin grupo (al final); si ninguna tiene, no hay carpetas de grupo.
 */
export const groupFoldersIfAny = <T extends LiquidationZipItem>(
  items: T[],
  // eslint-disable-next-line no-unused-vars
  noGroupFolder: (item: T) => string
): T[] => {
  if (!items.some((item) => item.group)) return items;
  return items.map((item) =>
    item.group
      ? item
      : { ...item, group: { folder: noGroupFolder(item), order: Number.POSITIVE_INFINITY } }
  );
};

/** Agrega " (n)" antes de la extensión. */
const withCounter = (path: string, n: number) => {
  const dot = path.lastIndexOf('.');
  const slash = path.lastIndexOf('/');
  return dot > slash ? `${path.slice(0, dot)} (${n})${path.slice(dot)}` : `${path} (${n})`;
};

/**
 * Ruta dentro del ZIP de cada archivo: `[raíz/][edición/][grupo/]archivo`,
 * ordenada por edición (en el orden en que llegan), grupo y llegada, sin
 * repetidos.
 */
export const liquidationZipEntries = <T extends LiquidationZipItem>(items: T[], root?: string) => {
  const editionOrder = new Map<string, number>();
  items.forEach((item) => {
    if (item.edition && !editionOrder.has(item.edition.key)) {
      editionOrder.set(item.edition.key, editionOrder.size);
    }
  });
  const rank = (item: T) => (item.edition ? (editionOrder.get(item.edition.key) ?? 0) : 0);
  const groupRank = (item: T) => item.group?.order ?? Number.POSITIVE_INFINITY;

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

  const rootFolder = root ? zipFolderName(root) : '';
  const used = new Set<string>();
  return sorted.map(({ item }) => {
    const base = [
      rootFolder,
      item.edition ? editionFolder(item.edition) : '',
      item.group ? zipFolderName(item.group.folder) : '',
      item.fileName,
    ]
      .filter(Boolean)
      .join('/');
    let path = base;
    for (let n = 2; used.has(path); n += 1) path = withCounter(base, n);
    used.add(path);
    return { path, item };
  });
};

/** La raíz del ZIP: su nombre sin `.zip`. */
export const zipRootFolder = (zipName: string) => zipName.replace(/\.zip$/i, '');
