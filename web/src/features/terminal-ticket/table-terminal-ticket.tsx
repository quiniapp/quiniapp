// TableTerminalTicket.tsx
import {
  Table, TableHeader, TableRow, TableHead, TableBody, TableCell,
} from '@/components/ui/table';
import { cn } from '@/lib/utils';
import { useSearchParams } from 'react-router-dom';
import { ITicketEntityFront } from '@helper/types/ticket.type';
import { useEffect, useMemo, useRef } from 'react';
import { Loader2 } from 'lucide-react';
import { useInfiniteTickets } from '@/hooks/fetchs/tickets/useInfiniteTickets';

interface TableTerminalTicketProps {
  user_id?: string;
  date?: string;
  winner?: boolean;
  paid?: boolean | null;
  not_paid?: boolean | null;
}

const dedupe = <T, K>(arr: T[], getKey: (x: T) => K) => {
  const seen = new Set<K>();
  const out: T[] = [];
  for (const item of arr) {
    const k = getKey(item);
    if (!seen.has(k)) { seen.add(k); out.push(item); }
  }
  return out;
};

const TableTerminalTicket = ({
  user_id, date, winner, paid, not_paid,
}: TableTerminalTicketProps) => {
  const [searchParams, setSearchParams] = useSearchParams();
  const selected = searchParams.get('ticket_number');

  const {
    data, fetchNextPage, hasNextPage, isFetchingNextPage, isLoading,
  } = useInfiniteTickets({
    user_id, date, winner, paid, not_paid, limit: 100,
  });

  // Flatten + dedupe por ticket_id
  const tickets = useMemo(() => {
    const flat = data?.pages.flatMap((p) => p.data) ?? [];
    return dedupe(flat, (t: ITicketEntityFront) => String(t.ticket_id));
  }, [data]);

  // Contenedor que scrollea (root) y sentinel al final
  const rootRef = useRef<HTMLDivElement | null>(null);
  const sentinelRef = useRef<HTMLDivElement | null>(null);

  // IO con root y prefetch 800px antes del fondo
  useEffect(() => {
    const root = rootRef.current;
    const target = sentinelRef.current;
    if (!root || !target) return;

    const io = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting && hasNextPage && !isFetchingNextPage) {
          fetchNextPage?.();
        }
      },
      { root, rootMargin: '0px 0px 800px 0px', threshold: 0 }
    );
    io.observe(target);
    return () => io.disconnect();
  }, [hasNextPage, isFetchingNextPage, fetchNextPage]);

  // Si no llena el contenedor, traigo otra página hasta llenar (o no haya más)
  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;
    if (root.scrollHeight <= root.clientHeight && hasNextPage && !isFetchingNextPage) {
      fetchNextPage?.();
    }
  }, [tickets.length, hasNextPage, isFetchingNextPage, fetchNextPage]);

  const handleClick = (ticket_number: string) => {
    if (selected === ticket_number) {
      const next = new URLSearchParams(searchParams);
      next.delete('ticket_number');
      setSearchParams(next);
    } else {
      const next = new URLSearchParams(searchParams);
      next.set('ticket_number', ticket_number);
      setSearchParams(next);
    }
  };

  if (isLoading) {
    return (
      <div className="border mb-1 sm:mb-4 h-[200px] 1440:h-[300px] flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
        <span className="ml-2 text-sm">Cargando tickets...</span>
      </div>
    );
  }

  return (
    <>
      <div className="border mb-1 sm:mb-4">
        <Table className="min-w-full table-fixed">
          <TableHeader>
            <TableRow className="bg-card-bg sticky top-0 z-10">
              <TableHead className="bg-card-bg text-white">Número</TableHead>
              <TableHead className="bg-card-bg text-white">Pasador</TableHead>
              <TableHead className="bg-card-bg text-white">Monto</TableHead>
              <TableHead className="hidden sm:table-cell bg-card-bg text-white text-right">Pagado</TableHead>
            </TableRow>
          </TableHeader>
        </Table>

        {/* root del scroll */}
        <div ref={rootRef} className="overflow-y-auto h-[200px] 1440:h-[300px]">
          <Table className="min-w-full table-fixed">
            <TableBody>
              {tickets.map((item) => (
                <TableRow
                  key={String(item.ticket_id)}
                  data-state={selected === item.ticket_number ? 'selected' : undefined}
                  className={cn(
                    `cursor-pointer hover:bg-primary-light transition ${
                      selected === item.ticket_number ? 'bg-primary-light' : ''
                    }`
                  )}
                  onClick={() => handleClick(item.ticket_number)}
                >
                  <TableCell>{item.ticket_number}</TableCell>
                  <TableCell>{item.user_name}</TableCell>
                  <TableCell>${item.total}</TableCell>
                  <TableCell className="hidden sm:table-cell text-right">
                    {item.paid ? 'Pagado' : 'No pagado'}
                  </TableCell>
                </TableRow>
              ))}

              {isFetchingNextPage && (
                <TableRow>
                  <TableCell colSpan={4} className="text-center p-4">
                    <div className="flex items-center justify-center">
                      <Loader2 className="w-5 h-5 animate-spin text-primary mr-2" />
                      <span className="text-sm text-muted-foreground">Cargando más tickets...</span>
                    </div>
                  </TableCell>
                </TableRow>
              )}

              {!hasNextPage && tickets.length > 0 && (
                <TableRow>
                  <TableCell colSpan={4} className="text-center p-4">
                    <span className="text-sm text-muted-foreground">
                      No hay más tickets ({tickets.length} total)
                    </span>
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>

          {/* sentinel */}
          {hasNextPage && !isFetchingNextPage && <div ref={sentinelRef} className="h-px w-full" />}
        </div>
      </div>

      <p className="text-xs">Cantidad de Tickets: {tickets.length}</p>
    </>
  );
};

export default TableTerminalTicket;
