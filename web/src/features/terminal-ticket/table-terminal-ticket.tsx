// TableTerminalTicket.tsx
import { Table, TableHeader, TableBody, TableCell, TableRow } from '@/components/ui/table';
import { ITicketEntityFront } from '@helper/types/ticket.type';
import { useMemo, useRef, useCallback } from 'react';
import { Loader2 } from 'lucide-react';
import { useInfiniteTickets } from '@/hooks/fetchs/tickets/useInfiniteTickets';
import { TicketTableHeader, TicketTableRow } from './ticket-table-row';
import { useInfiniteScroll } from '@/hooks/useInfiniteScroll';
import { useTerminalTicket } from './provider/TerminalTicketProvider';

interface TableTerminalTicketProps {
  user_id?: string;
  date?: string;
  winner?: boolean;
  paid?: boolean | null;
  not_paid?: boolean | null;
  group_id?: string;
}

const dedupe = <T, K>(arr: T[], getKey: (x: T) => K) => {
  const seen = new Set<K>();
  const out: T[] = [];
  for (const item of arr) {
    const k = getKey(item);
    if (!seen.has(k)) {
      seen.add(k);
      out.push(item);
    }
  }
  return out;
};

const TableTerminalTicket = ({
  user_id,
  date,
  winner,
  paid,
  not_paid,
  group_id,
}: TableTerminalTicketProps) => {
  const { ticket_number, toggleTicketNumber, setPayTicket } = useTerminalTicket();

  const { data, fetchNextPage, hasNextPage, isFetchingNextPage, isLoading } = useInfiniteTickets({
    user_id,
    date,
    winner,
    paid,
    not_paid,
    group_id,
    limit: 50,
  });

  // Flatten + dedupe por ticket_id
  const tickets = useMemo(() => {
    const flat = data?.pages.flatMap((p) => p.data) ?? [];
    return dedupe(flat, (t: ITicketEntityFront) => String(t.ticket_id));
  }, [data]);

  // Contenedor que scrollea
  const rootRef = useRef<HTMLDivElement | null>(null);


  const { setTriggerRef, triggerIndex } = useInfiniteScroll({
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
    root: rootRef.current,
    offsetFromEnd: 30,
    totalItems: tickets.length,
  });

  const handleClick = useCallback(
    (ticketNumber: string) => {
      toggleTicketNumber(ticketNumber);
      const ticket = tickets.find((t) => t.ticket_number === ticketNumber);
      setPayTicket(!ticket?.paid && ticket?.winner);
    },
    [toggleTicketNumber, tickets, setPayTicket]
  );

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
            <TicketTableHeader />
          </TableHeader>
        </Table>

        {/* root del scroll */}
        <div ref={rootRef} className="overflow-y-auto h-[200px] 1440:h-[300px]">
          <Table className="min-w-full table-fixed">
            <TableBody>
              {tickets.map((item, index) => (
                <TicketTableRow
                  key={String(item.ticket_id)}
                  ref={index === triggerIndex ? setTriggerRef : undefined}
                  ticket={item}
                  isSelected={ticket_number === item.ticket_number}
                  onClick={handleClick}
                />
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
        </div>
      </div>

      <p className="text-xs">Cantidad de Tickets: {tickets.length}</p>
    </>
  );
};

export default TableTerminalTicket;
