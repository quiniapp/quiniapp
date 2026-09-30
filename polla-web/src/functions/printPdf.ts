/** Impresión y compartido de PDFs, igual que en QuiniApp. */

export function printPdfBlob(blob: Blob) {
  const url = URL.createObjectURL(blob);
  const iframe = document.createElement('iframe');
  iframe.style.cssText = 'position:fixed;right:0;bottom:0;width:0;height:0;border:0';
  iframe.src = url;
  document.body.appendChild(iframe);
  iframe.onload = () => {
    iframe.contentWindow?.focus();
    const cleanup = () => {
      if (document.body.contains(iframe)) document.body.removeChild(iframe);
      URL.revokeObjectURL(url);
      iframe.contentWindow?.removeEventListener('afterprint', cleanup);
    };
    iframe.contentWindow?.addEventListener('afterprint', cleanup);
    iframe.contentWindow?.print();
  };
}

export async function sharePdfBlob(blob: Blob, fileName: string, opts?: { text?: string }) {
  try {
    const file = new File([blob], fileName, { type: 'application/pdf' });
    if (navigator.canShare?.({ files: [file] })) {
      await navigator.share({
        title: 'Ticket Polla',
        text: opts?.text ?? 'Te comparto el ticket',
        files: [file],
      });
      return true;
    }
  } catch {
    // Sin Web Share API se cae a WhatsApp.
  }

  const message = encodeURIComponent(opts?.text ?? 'Te comparto el ticket');
  window.open(`https://wa.me/?text=${message}`, '_blank', 'noopener,noreferrer');
  return false;
}

export const isMobileDevice = () => /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);

/** En desktop imprime; en mobile abre el share sheet. */
export const deliverPdf = async (blob: Blob, fileName: string, text: string) => {
  try {
    if (isMobileDevice()) {
      await sharePdfBlob(blob, fileName, { text });
      return;
    }
    printPdfBlob(blob);
  } catch {
    printPdfBlob(blob);
  }
};
