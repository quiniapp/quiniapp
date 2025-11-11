import {
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';

import { IBetEntityFront } from '@helper/types/bet.type';
import { betPlaceDictionary } from '@helper/functions/betPlaceDictionary';
import toast from 'react-hot-toast';
import { Copy, Check } from 'lucide-react';
import { useState } from 'react';
import { cn } from '@/lib/utils';

type Props = { bets?: IBetEntityFront[] };

const currency = (n?: number | string) =>
  typeof n === 'number'
    ? n.toLocaleString('es-AR', { style: 'currency', currency: 'ARS', maximumFractionDigits: 0 })
    : (n ?? '');

const PlaysAndHitsTable: React.FC<Props> = ({ bets = [] }) => {
  return (
    <div className="flex-1 min-h-40 max-h-full overflow-y-auto overflow-x-hidden w-full">
      {/* ====== DESKTOP/TABLET: tabla (>= md) ====== */}
      <div className="hidden md:block overflow-x-auto w-full">
        <Table className="w-full min-w-[900px]">
         

          <TableCaption className={!bets?.length ? '' : 'hidden'}>
            No se encontraron jugadas
          </TableCaption>

          <TableHeader className="sticky top-0 bg-background z-10">
            <TableRow className="bg-[#06081322] h-11">
              <TableHead className="px-2 sm:px-3 whitespace-nowrap text-sm md:text-base">Jugada</TableHead>
              <TableHead className="px-2 sm:px-3 whitespace-nowrap text-sm md:text-base">Monto</TableHead>
              <TableHead className="px-2 sm:px-3 whitespace-nowrap text-sm md:text-base">Tipo</TableHead>
              <TableHead className="px-2 sm:px-3 whitespace-nowrap text-sm md:text-base">Turno</TableHead>
              <TableHead className="px-2 sm:px-3 whitespace-nowrap text-sm md:text-base">Quiniela</TableHead>
              <TableHead className="px-2 sm:px-3 whitespace-nowrap text-sm md:text-base">Aciertos</TableHead>
              <TableHead className="px-2 sm:px-3 whitespace-nowrap text-sm md:text-base">$ Aciertos</TableHead>
              <TableHead className="px-2 sm:px-3 whitespace-nowrap text-sm md:text-base font-semibold">Ticket</TableHead>
              <TableHead className="px-2 sm:px-3 whitespace-nowrap text-sm md:text-base">Usuario</TableHead>
            </TableRow>
          </TableHeader>

          <TableBody>
            {bets?.map((bet: IBetEntityFront, index: number) => (
              <TableRow key={index}>
                <TableCell className="px-2 sm:px-3 whitespace-nowrap text-sm md:text-base lg:text-lg font-semibold">
                  {bet.number}
                </TableCell>
                <TableCell className="px-2 sm:px-3 whitespace-nowrap text-sm md:text-base lg:text-lg">
                  {currency(bet.amount)}
                </TableCell>
                <TableCell className="px-2 sm:px-3 whitespace-nowrap text-sm md:text-base lg:text-lg">
                  {betPlaceDictionary[bet.place]}
                </TableCell>
                <TableCell className="px-2 sm:px-3 whitespace-nowrap text-sm md:text-base lg:text-lg">
                  {bet.schedule?.name}
                </TableCell>
                <TableCell className="px-2 sm:px-3 whitespace-nowrap text-sm md:text-base lg:text-lg">
                  {bet.lottery?.name}
                </TableCell>
                <TableCell className="px-2 sm:px-3 whitespace-nowrap text-sm md:text-base lg:text-lg">
                  {bet.hits}
                </TableCell>
                <TableCell className="px-2 sm:px-3 whitespace-nowrap text-sm md:text-base lg:text-lg">
                  {currency(bet.prize)}
                </TableCell>
                <TableCell className="px-2 sm:px-3">
                  <CopyableTicket ticketNumber={bet.ticket_number} />
                </TableCell>
                <TableCell className="px-2 sm:px-3 whitespace-nowrap text-sm md:text-base lg:text-lg max-w-[150px] truncate">
                  {bet.cashier_name}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      {/* ====== MOBILE: cards (< md) ====== */}
      <div className="md:hidden space-y-3 p-2">
        {(!bets || bets.length === 0) && (
          <p className="text-center text-sm text-muted-foreground">No se encontraron jugadas</p>
        )}

        {bets?.map((bet, i) => (
          <div
            key={i}
            className="rounded-xl border border-white/10 bg-[#0d1124] p-4 text-white shadow-sm"
          >
            {/* Header con jugada y monto destacados */}
            <div className="flex justify-between items-start mb-3 pb-3 border-b border-white/10">
              <div>
                <span className="text-xs font-medium text-blue-200/80 uppercase tracking-wide">
                  Jugada
                </span>
                <p className="text-lg font-bold text-white">{bet.number}</p>
              </div>
              <div className="text-right">
                <span className="text-xs font-medium text-blue-200/80 uppercase tracking-wide">
                  Monto
                </span>
                <p className="text-lg font-bold text-primary">{currency(bet.amount)}</p>
              </div>
            </div>

            {/* Grid de información */}
            <div className="grid grid-cols-2 gap-x-4 gap-y-3 mb-3">
              <Field label="Tipo" value={betPlaceDictionary[bet.place]} />
              <Field label="Aciertos" value={String(bet.hits ?? 0)} />
              <Field label="Turno" value={bet.schedule?.name} />
              <Field label="Quiniela" value={bet.lottery?.name} />
              <Field label="Premio" value={currency(bet.prize)} />
              <Field label="Usuario" value={bet.cashier_name} />
            </div>

            {/* Ticket destacado y clickeable */}
            <div className="mt-3 pt-3 border-t border-white/10">
              <span className="text-xs font-medium text-blue-200/80 uppercase tracking-wide block mb-2">
                Número de Ticket
              </span>
              <CopyableTicket ticketNumber={bet.ticket_number} isMobile />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

/** Subcomponente para fila label → valor */
const Field: React.FC<{
  label: string;
  value?: string;
}> = ({ label, value = '-' }) => {
  return (
    <div className="flex flex-col">
      <span className="text-xs font-medium text-blue-200/80 uppercase tracking-wide">
        {label}
      </span>
      <span className="text-sm font-semibold text-white truncate">{value}</span>
    </div>
  );
};

/** Componente para copiar número de ticket */
const CopyableTicket: React.FC<{
  ticketNumber?: string;
  isMobile?: boolean;
}> = ({ ticketNumber, isMobile = false }) => {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    if (!ticketNumber) return;

    try {
      await navigator.clipboard.writeText(ticketNumber);
      setCopied(true);
      toast.success('Número de ticket copiado', {
        duration: 2000,
        position: 'top-center',
      });

      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      toast.error('Error al copiar el ticket');
    }
  };

  if (isMobile) {
    return (
      <button
        onClick={handleCopy}
        className={cn(
          'w-full flex items-center justify-between gap-2 px-4 py-3 rounded-lg transition-all',
          'bg-primary/10 hover:bg-primary/20 border border-primary/30',
          'active:scale-95'
        )}
      >
        <span className="text-base font-bold text-primary">{ticketNumber || '-'}</span>
        {copied ? (
          <Check className="w-5 h-5 text-green-500" />
        ) : (
          <Copy className="w-5 h-5 text-primary" />
        )}
      </button>
    );
  }

  return (
    <button
      onClick={handleCopy}
      className={cn(
        'group flex items-center gap-2 px-2 py-1 rounded transition-all',
        'hover:bg-primary/20 active:scale-95',
        'text-sm md:text-base lg:text-lg font-bold'
      )}
    >
      <span className="text-white">{ticketNumber || '-'}</span>
      {copied ? (
        <Check className="w-4 h-4 text-green-500" />
      ) : (
        <Copy className="w-4 h-4 text-muted-foreground group-hover:text-primary transition-colors" />
      )}
    </button>
  );
};

export default PlaysAndHitsTable;
