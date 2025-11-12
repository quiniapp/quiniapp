import {
  Table,
  TableHeader,
  TableRow,
  TableHead,
  TableBody,
  TableCell,
} from '@/components/ui/table';
import { cn } from '@/lib/utils';
import { useSearchParams } from 'react-router-dom';
import { ITicketEntityFront } from '@helper/types/ticket.type';
import { useIntersectionObserver } from '@/hooks/useIntersectionObserver';
import { useEffect, useMemo } from 'react';
import { Loader2 } from 'lucide-react';
import { useInfiniteTickets } from '@/hooks/fetchs/tickets/useInfiniteTickets';

interface TableTerminalTicketProps {
  user_id?: string;
  date?: string;
  winner?: boolean;
  paid?: boolean | null;
  not_paid?: boolean | null;
}

const TableTerminalTicket = ({
  user_id,
  date,
  winner,
  paid,
  not_paid,
}: TableTerminalTicketProps) => {
  const [searchParams, setSearchParams] = useSearchParams();
  const selected = searchParams.get('ticket_number');

  const {
    data,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
    isLoading,
  } = useInfiniteTickets({
    user_id,
    date,
    winner,
    paid,
    not_paid,
    limit: 100,
  });

  // Flatten all pages into a single array
  const tickets = useMemo(() => {
    return data?.pages.flatMap((page) => page.data) ?? [];
  }, [data]);

  // Ref para el trigger element (cargar más al llegar a la fila 60)
  const [triggerRef, isIntersecting] = useIntersectionObserver<HTMLTableRowElement>({
    threshold: 0.1,
    rootMargin: '200px',
  });

  // Detectar cuando el elemento trigger es visible
  useEffect(() => {
    if (isIntersecting && hasNextPage && !isFetchingNextPage && fetchNextPage) {
      fetchNextPage();
    }
  }, [isIntersecting, hasNextPage, isFetchingNextPage, fetchNextPage]);

  const handleClick = (ticket_number: string) => {
    if (selected === ticket_number) {
      searchParams.delete('ticket_number');
      setSearchParams(searchParams);
    } else {
      const params = new URLSearchParams(searchParams);
      params.set('ticket_number', ticket_number);
      setSearchParams(params);
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
              {/* ⬇️ Se oculta en <sm */}
              <TableHead className="hidden sm:table-cell bg-card-bg text-white text-right">
                Pagado
              </TableHead>
            </TableRow>
          </TableHeader>
        </Table>

      <div className="overflow-y-auto h-[200px] 1440:h-[300px]">
        <Table className="min-w-full table-fixed">
          <TableBody>
            {tickets?.map((item: ITicketEntityFront, index: number) => {
              const isTriggerRow = index === Math.min(60, tickets.length - 1);
              return (
                <TableRow
                  key={item.ticket_id}
                  ref={isTriggerRow ? triggerRef : null}
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
                  {/* ⬇️ También se oculta en <sm */}
                  <TableCell className="hidden sm:table-cell text-right">
                    {item.paid ? 'Pagado' : 'No pagado'}
                  </TableCell>
                </TableRow>
              );
            })}
            {/* Loading indicator */}
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
            {/* End of list indicator */}
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
      <p className="text-xs">Cantidad de Tickets: {tickets?.length}</p>
    </>
  );
};

export default TableTerminalTicket;
