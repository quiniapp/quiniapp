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
import toast from 'react-hot-toast';
import { Copy, Check, Loader2 } from 'lucide-react';
import { useState, useEffect, useMemo, useRef } from 'react';
import { cn } from '@/lib/utils';
import { useSearchParams } from 'react-router-dom';
import { useInfiniteBets } from '@/hooks/fetchs/plays/useInfiniteBets';
import { betTypeAndPlaceLabel } from '@helper/functions/betTypeDictionary';

type Props = {
  onTotalsUpdate?: (totalAmount?: number, totalPrize?: number) => void;
};

const currency = (n?: number | string) =>
  typeof n === 'number'
    ? n.toLocaleString('es-AR', { style: 'currency', currency: 'ARS', maximumFractionDigits: 0 })
    : (n ?? '');

const PlaysAndHitsTable: React.FC<Props> = ({ onTotalsUpdate }) => {
  const [searchParams] = useSearchParams();
  const schedule_id = searchParams.get('schedule_id');
  const date = searchParams.get('date');
  const lottery_id = searchParams.get('lottery_id');
  const cashier_id = searchParams.get('cashier_id');
  const grouped = searchParams.get('grouped');
  const winners = searchParams.get('winners');
  const quatern = searchParams.get('quatern');
  const tern = searchParams.get('tern');

  const { data, fetchNextPage, hasNextPage, isFetchingNextPage, isLoading } = useInfiniteBets({
    schedule_id,
    date,
    cashier_id,
    lottery_id,
    grouped,
    quatern,
    tern,
    winners,
    limit: 100,
  });

  // Flatten all pages into a single array
  // Reemplazá tu 'bets' por este 'bets' deduplicado
  const bets = useMemo(() => {
    return data?.pages.flatMap((p) => p.data) ?? [];
  }, [data]);

  const toFinite = (v: unknown, def = 0) => {
    const n = typeof v === 'number' ? v : typeof v === 'string' ? Number(v) : NaN;
    return Number.isFinite(n) ? n : def;
  };

  useEffect(() => {
    const agg = data?.pages?.[0]?.aggregates;
    onTotalsUpdate?.(toFinite(agg?.totalAmount, 0), toFinite(agg?.totalPrize, 0));
  }, [data, onTotalsUpdate]);

  // 1) Contenedor scrolleable (root del IO) + sentinel al final
  const scrollRootRef = useRef<HTMLDivElement | null>(null);
  const sentinelRef = useRef<HTMLDivElement | null>(null);

  // 2) IntersectionObserver usando el contenedor como root
  useEffect(() => {
    const root = scrollRootRef.current;
    const target = sentinelRef.current;
    if (!root || !target) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting && hasNextPage && !isFetchingNextPage) {
          fetchNextPage();
        }
      },
      {
        root, // 👈 contenedor que scrollea
        rootMargin: '0px 0px 800px 0px', // prefetch antes de llegar al fondo
        threshold: 0,
      }
    );

    observer.observe(target);
    return () => observer.disconnect();
  }, [hasNextPage, isFetchingNextPage, fetchNextPage]);

  // 3) Si el contenido no llena el viewport del contenedor, trae más hasta que llene o no haya más
  useEffect(() => {
    const root = scrollRootRef.current;
    if (!root) return;
    if (root.scrollHeight <= root.clientHeight && hasNextPage && !isFetchingNextPage) {
      fetchNextPage();
    }
  }, [bets.length, hasNextPage, isFetchingNextPage, fetchNextPage]);

  if (isLoading) {
    return (
      <div className="flex-1 flex items-center justify-center p-8">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
        <span className="ml-2 text-sm">Cargando datos...</span>
      </div>
    );
  }
  return (
    // 👇 Este es el root del scroll + el ref usado en el IO
    <div
      ref={scrollRootRef}
      className="flex-1 min-h-40 max-h-full overflow-y-auto overflow-x-hidden w-full"
    >
      {/* ===== DESKTOP/TABLET ===== */}
      <div className="hidden md:block overflow-x-auto w-full">
        <Table className="w-full min-w-[900px]">
          <TableCaption className={!bets?.length ? '' : 'hidden'}>
            No se encontraron jugadas
          </TableCaption>

          <TableHeader className="sticky top-0 bg-background z-10">
            <TableRow className="bg-[#06081322] h-11">
              <TableHead className="px-2 sm:px-3 whitespace-nowrap text-sm md:text-base">
                Jugada
              </TableHead>
              <TableHead className="px-2 sm:px-3 whitespace-nowrap text-sm md:text-base">
                Monto
              </TableHead>
              <TableHead className="px-2 sm:px-3 whitespace-nowrap text-sm md:text-base">
                Tipo
              </TableHead>
              <TableHead className="px-2 sm:px-3 whitespace-nowrap text-sm md:text-base">
                Turno
              </TableHead>
              <TableHead className="px-2 sm:px-3 whitespace-nowrap text-sm md:text-base">
                Quiniela
              </TableHead>
              <TableHead className="px-2 sm:px-3 whitespace-nowrap text-sm md:text-base">
                Aciertos
              </TableHead>
              <TableHead className="px-2 sm:px-3 whitespace-nowrap text-sm md:text-base">
                $ Aciertos
              </TableHead>
              <TableHead className="px-2 sm:px-3 whitespace-nowrap text-sm md:text-base font-semibold">
                Ticket
              </TableHead>
              <TableHead className="px-2 sm:px-3 whitespace-nowrap text-sm md:text-base">
                Usuario
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {bets?.map((bet: IBetEntityFront) => (
              <TableRow key={bet?.bet_id ?? Math.random()}>
                <TableCell className="px-2 sm:px-3 whitespace-nowrap text-sm md:text-base lg:text-lg font-semibold">
                  {bet.number}{`${bet?.with? ` - ${bet.with}` : ''}`}
                </TableCell>
                <TableCell className="px-2 sm:px-3 whitespace-nowrap text-sm md:text-base lg:text-lg">
                  {currency(bet.amount)}
                </TableCell>
                <TableCell className="px-2 sm:px-3 whitespace-nowrap text-sm md:text-base lg:text-lg">
                  {betTypeAndPlaceLabel(bet.bet_type,bet.place,bet.position)}
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

            {isFetchingNextPage && (
              <TableRow>
                <TableCell colSpan={9} className="text-center p-4">
                  <div className="flex items-center justify-center">
                    <Loader2 className="w-5 h-5 animate-spin text-primary mr-2" />
                    <span className="text-sm text-muted-foreground">Cargando más jugadas...</span>
                  </div>
                </TableCell>
              </TableRow>
            )}

            {!hasNextPage && bets.length > 0 && (
              <TableRow>
                <TableCell colSpan={9} className="text-center p-4">
                  <span className="text-sm text-muted-foreground">
                    No hay más jugadas ({bets.length} total)
                  </span>
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      {/* ===== MOBILE ===== */}
      <div className="md:hidden space-y-3 p-2">
        {(!bets || bets.length === 0) && (
          <p className="text-center text-sm text-muted-foreground">No se encontraron jugadas</p>
        )}

        {bets?.map((bet) => (
          <div
            key={bet?.bet_id ?? Math.random()}
            className="rounded-xl border border-white/10 bg-[#0d1124] p-4 text-white shadow-sm"
          >
            <div className="flex justify-between items-start mb-3 pb-3 border-b border-white/10">
              <div>
                <span className="text-xs font-medium text-blue-200/80 uppercase tracking-wide">
                  Jugada
                </span>
                <p className="text-lg font-bold text-white">{bet.number}{`${bet?.with? ` - ${bet.with}` : ''}`}</p>
              </div>
              <div className="text-right">
                <span className="text-xs font-medium text-blue-200/80 uppercase tracking-wide">
                  Monto
                </span>
                <p className="text-lg font-bold text-primary">{currency(bet.amount)}</p>
              </div>
            </div>

            {/* Grid de información */}
            <div className="grid grid-cols-3 gap-x-4 gap-y-3 mb-3">
              <Field label="Tipo" value={betTypeAndPlaceLabel(bet.bet_type,bet.place,bet.position)} />
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

        {isFetchingNextPage && (
          <div className="flex items-center justify-center p-4">
            <Loader2 className="w-5 h-5 animate-spin text-primary mr-2" />
            <span className="text-sm text-muted-foreground">Cargando más jugadas...</span>
          </div>
        )}

        {!hasNextPage && bets.length > 0 && (
          <div className="flex items-center justify-center p-4">
            <span className="text-sm text-muted-foreground">
              No hay más jugadas ({bets.length} total)
            </span>
          </div>
        )}
      </div>

      {/* 👇 Sentinel al final del contenedor scrolleable */}
      <div ref={sentinelRef} className="h-px w-full" />
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
      <span className="text-xs font-medium text-blue-200/80 uppercase tracking-wide">{label}</span>
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
      <span className="text-primary">{ticketNumber || '-'}</span>
      {copied ? (
        <Check className="w-4 h-4 text-green-500" />
      ) : (
        <Copy className="w-4 h-4 text-muted-foreground group-hover:text-primary transition-colors" />
      )}
    </button>
  );
};

export default PlaysAndHitsTable;
