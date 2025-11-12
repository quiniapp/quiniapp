import {
  Table,
  TableHeader,
  TableHead,
  TableRow,
  TableBody,
  TableCell,
} from '@/components/ui/table';
import SkeletonList from '@/components/skeletons/skeleton-list';
import { IBetEntityFront } from '@helper/types/bet.type';
import { useIntersectionObserver } from '@/hooks/useIntersectionObserver';
import { useEffect } from 'react';
import { Loader2 } from 'lucide-react';

interface TerminalTicketPlayTableProps {
  bets?: IBetEntityFront[];
  isLoading?: boolean;
  hasNextPage?: boolean;
  isFetchingNextPage?: boolean;
  fetchNextPage?: () => void;
  /** opcional: alto máximo del body */
  maxBodyHeightClass?: string; // ej "max-h-[60vh]"
}

const TerminalTicketPlayTable = ({
  bets = [],
  isLoading = false,
  hasNextPage = false,
  isFetchingNextPage = false,
  fetchNextPage,
  maxBodyHeightClass = 'max-h-[50vh]', // ajustá a tu layout
}: TerminalTicketPlayTableProps) => {
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

  if (isLoading) return <SkeletonList />;

  return (
    <div className="flex-1 min-h-40">
      <div className={` rounded-md border`}>
        <Table className="table-fixed">
          <TableHeader>
            <TableRow>
              <TableHead>Jugada</TableHead>
              <TableHead>Monto</TableHead>
              <TableHead>Quiniela</TableHead>
              <TableHead>Tipo</TableHead>
              <TableHead>Turno</TableHead>
            </TableRow>
          </TableHeader>
        </Table>
        <div className={`overflow-y-auto ${maxBodyHeightClass}`}>
          <Table className="table-fixed ">
            <TableBody>
              {bets?.map((bet, index) => {
                const isTriggerRow = index === Math.min(60, bets.length - 1);
                return (
                  <TableRow key={bet.bet_id} ref={isTriggerRow ? triggerRef : null}>
                    <TableCell className="truncate">{bet.number}</TableCell>
                    <TableCell className="whitespace-nowrap">${bet.amount}</TableCell>
                    <TableCell className="truncate">{bet.lottery.name}</TableCell>
                    <TableCell className="truncate">{bet.bet_type}</TableCell>
                    <TableCell className="truncate">{bet.schedule.name}</TableCell>
                  </TableRow>
                );
              })}
              {/* Loading indicator */}
              {isFetchingNextPage && (
                <TableRow>
                  <TableCell colSpan={5} className="text-center p-4">
                    <div className="flex items-center justify-center">
                      <Loader2 className="w-5 h-5 animate-spin text-primary mr-2" />
                      <span className="text-sm text-muted-foreground">Cargando más jugadas...</span>
                    </div>
                  </TableCell>
                </TableRow>
              )}
              {/* End of list indicator */}
              {!hasNextPage && bets.length > 0 && (
                <TableRow>
                  <TableCell colSpan={5} className="text-center p-4">
                    <span className="text-sm text-muted-foreground">
                      No hay más jugadas ({bets.length} total)
                    </span>
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      </div>
    </div>
  );
};

export default TerminalTicketPlayTable;
