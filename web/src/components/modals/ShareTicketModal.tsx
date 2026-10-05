import { FileTextIcon, ImageIcon, Loader2, PrinterIcon } from 'lucide-react';
import { ReactNode, useMemo, useState } from 'react';
import toast from 'react-hot-toast';

import { makeTicketPdf, PrintableTicket, printPdfBlob } from '@/functions/makeTicket';
import { makeTicketImages } from '@/functions/makeTicketImage';
import { downloadFiles, shareFiles } from '@/functions/shareFiles';
import { cn } from '@/lib/utils';
import { Button } from '../ui/button';
import Modal from './custom-modal';

type Format = 'image' | 'pdf' | 'print';

interface ShareTicketModalProps {
  ticket: PrintableTicket | null;
  onClose: VoidFunction;
}

type Option = { format: Format; label: string; description: string; icon: ReactNode };

const ShareTicketModal = ({ ticket, onClose }: ShareTicketModalProps) => {
  const [busy, setBusy] = useState<Format | null>(null);
  const isMobile = /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);

  // Se generan apenas se abre el modal: así el share sale en el mismo toque del usuario
  // (Safari lo rechaza si en el medio hay una espera larga, ver shareFiles)
  const files = useMemo(() => {
    if (!ticket) return null;
    const pdf = makeTicketPdf(ticket).then(
      ({ blob, fileName }) => new File([blob], fileName, { type: 'application/pdf' })
    );
    const images = makeTicketImages(ticket);
    // si fallan, el error se informa al elegir esa opción
    pdf.catch(() => undefined);
    images.catch(() => undefined);
    return { pdf, images };
  }, [ticket]);

  // En celular no hay "Imprimir": el PDF no se puede imprimir desde un iframe
  // (Android no lo renderiza); se imprime compartiéndolo a la app de la impresora
  const options: Option[] = isMobile
    ? [
        {
          format: 'image',
          label: 'Imagen',
          description: 'Se ve en el chat sin abrirla',
          icon: <ImageIcon />,
        },
        {
          format: 'pdf',
          label: 'PDF',
          description: 'Para imprimir o archivar',
          icon: <FileTextIcon />,
        },
      ]
    : [
        {
          format: 'print',
          label: 'Imprimir',
          description: 'Enviar a la impresora',
          icon: <PrinterIcon />,
        },
        {
          format: 'image',
          label: 'Imagen',
          description: 'Descargar como foto (PNG)',
          icon: <ImageIcon />,
        },
        { format: 'pdf', label: 'PDF', description: 'Descargar el PDF', icon: <FileTextIcon /> },
      ];

  const handleSelect = async (format: Format) => {
    if (!files || busy) return;
    setBusy(format);
    try {
      if (format === 'print') {
        printPdfBlob(await files.pdf);
        onClose();
        return;
      }

      const toSend = format === 'image' ? await files.images : [await files.pdf];
      if (!isMobile) {
        downloadFiles(toSend);
        onClose();
        return;
      }

      const result = await shareFiles(toSend);
      if (result === 'blocked') {
        toast('Tocá de nuevo para compartir');
        return;
      }
      if (result !== 'cancelled') onClose();
    } catch {
      toast.error('No se pudo generar el comprobante. Probá de nuevo.');
    } finally {
      setBusy(null);
    }
  };

  return (
    <Modal
      title={ticket ? `Ticket ${ticket.ticket.ticket_number}` : 'Ticket'}
      description={isMobile ? '¿Cómo querés compartirlo?' : '¿Qué querés hacer con el ticket?'}
      isOpen={!!ticket}
      onClose={onClose}
      className="!max-w-[90vw] sm:!max-w-[420px] w-full m-auto bg-[#060813]"
    >
      <div className="flex flex-col gap-2">
        {options.map(({ format, label, description, icon }, i) => (
          <Button
            key={format}
            type="button"
            variant={i === 0 ? 'default' : 'outline'}
            disabled={busy !== null}
            onClick={() => handleSelect(format)}
            className="h-auto w-full justify-start gap-3 py-3 [&_svg:not([class*='size-'])]:size-5"
          >
            {busy === format ? <Loader2 className="animate-spin" /> : icon}
            <span className="flex flex-col items-start text-left">
              <span className="text-base font-semibold">{label}</span>
              <span
                className={cn(
                  'text-xs font-normal whitespace-normal',
                  i === 0 ? 'opacity-80' : 'text-muted-foreground'
                )}
              >
                {description}
              </span>
            </span>
          </Button>
        ))}
      </div>
    </Modal>
  );
};

export default ShareTicketModal;
