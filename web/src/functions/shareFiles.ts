export type ShareResult = 'shared' | 'cancelled' | 'blocked' | 'downloaded';

/**
 * Abre la hoja de compartir del sistema con los archivos; si el navegador no puede
 * compartirlos, los descarga.
 *
 * Solo se mandan `files`: en iOS, si se agrega `text`, WhatsApp descarta los archivos.
 * Hay que llamarla con los archivos ya generados: Safari rechaza el share
 * (`NotAllowedError`) si pasa mucho tiempo entre el toque del usuario y la llamada.
 */
export async function shareFiles(files: File[]): Promise<ShareResult> {
  if (navigator.canShare?.({ files })) {
    try {
      await navigator.share({ files });
      return 'shared';
    } catch (err) {
      if (err instanceof DOMException && err.name === 'AbortError') return 'cancelled';
      if (err instanceof DOMException && err.name === 'NotAllowedError') return 'blocked';
      // cualquier otro error: caemos a la descarga
    }
  }
  downloadFiles(files);
  return 'downloaded';
}

export function downloadFiles(files: File[]) {
  for (const file of files) {
    const url = URL.createObjectURL(file);
    const link = document.createElement('a');
    link.href = url;
    link.download = file.name;
    document.body.appendChild(link);
    link.click();
    link.remove();
    // Safari necesita que la URL siga viva un momento después del click
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
}
