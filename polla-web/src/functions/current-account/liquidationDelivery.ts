import { looseFileNames, shouldZipImages, zipFiles } from '@/lib/liquidationZip';
import { isMobileDevice, shareFile } from '../printPdf';
import { shareFiles } from '../shareFiles';

/**
 * Entrega de las liquidaciones exportadas. PDF, o imagen en la computadora: un
 * ZIP. Imagen en el celular: las imágenes sueltas por la hoja de compartir (si
 * el navegador no puede, o son demasiadas, el ZIP).
 */

export type LiquidationFormat = 'pdf' | 'image';

export interface PreparedLiquidation {
  zipName: string;
  format: LiquidationFormat;
  /** `path` es la ruta dentro del ZIP. */
  files: { path: string; blob: Blob }[];
}

const shareZip = async ({ files, zipName }: PreparedLiquidation) => {
  const zip = await zipFiles(
    await Promise.all(
      files.map(async ({ path, blob }) => ({
        path,
        data: new Uint8Array(await blob.arrayBuffer()),
      }))
    )
  );
  await shareFile(zip, zipName, 'Liquidaciones de la Polla', 'application/zip');
};

/**
 * `'blocked'`: el navegador pidió un toque nuevo para compartir (Safari lo
 * exige si pasó mucho desde el toque original): hay que reintentar con
 * `deliverLiquidation` sin preparar de nuevo. Con `retry` (ya es un toque nuevo) un
 * segundo bloqueo es definitivo: se entrega el ZIP en vez de volver a `blocked`.
 */
export const deliverLiquidation = async (
  prepared: PreparedLiquidation,
  { retry = false }: { retry?: boolean } = {}
): Promise<'done' | 'blocked' | 'cancelled'> => {
  if (prepared.format === 'image' && isMobileDevice()) {
    const names = looseFileNames(prepared.files.map((f) => f.path));
    const files = prepared.files.map((f, i) => new File([f.blob], names[i], { type: 'image/png' }));
    if (!shouldZipImages(files) && navigator.canShare?.({ files })) {
      // Sin bajar las imágenes una por una: si falla, el ZIP.
      const result = await shareFiles(files, { fallbackDownload: false });
      if (result === 'blocked' && !retry) return 'blocked';
      if (result === 'cancelled') return 'cancelled';
      if (result === 'shared') return 'done';
    }
  }
  await shareZip(prepared);
  return 'done';
};
