// termina-ticket-play-table.tsx
import {
  Table, TableHeader, TableHead, TableRow, TableBody, TableCell,
} from '@/components/ui/table';
import SkeletonList from '@/components/skeletons/skeleton-list';
import { IBetEntityFront } from '@helper/types/bet.type';
import { useMemo, useRef, memo } from 'react';
import { Loader2 } from 'lucide-react';
import { useInfiniteBetsByTicketNumber } from '@/hooks/fetchs/plays/useInfiniteBetsByTicketNumber';
import { betTypeAndPlaceLabel } from '@helper/functions/betTypeDictionary';
import { useInfiniteScroll } from '@/hooks/useInfiniteScroll';
import { useTerminalTicket } from './provider/TerminalTicketProvider';

interface Props {
  amount:number
  maxBodyHeightClass?: string; // ej "max-h-[60vh]"
  count:number
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

/** Fila memoizada para plays */
const BetRowMemoized = memo<{
  bet: IBetEntityFront;
  triggerRef?: (node: HTMLTableRowElement | null) => void;
}>(function BetRowMemoized({ bet, triggerRef }) {
  return (
    <TableRow
      key={String(bet.bet_id)}
      ref={triggerRef}
    >
      <TableCell className="truncate">{bet.number}{`${bet?.with? ` - ${bet.with}` : ''}`}</TableCell>
      <TableCell className="whitespace-nowrap">${bet.amount}</TableCell>
      <TableCell className="truncate">{bet.lottery.name}</TableCell>
      <TableCell className="truncate">{betTypeAndPlaceLabel(bet.bet_type,bet.place,bet.position)}</TableCell>
      <TableCell className="truncate">{bet.schedule.name}</TableCell>
    </TableRow>
  );
}, (prev, next) => {
  return prev.bet.bet_id === next.bet.bet_id && prev.triggerRef === next.triggerRef;
});

const TerminalTicketPlayTable = ({
  amount,
  count,
  maxBodyHeightClass = 'max-h-[50vh]',
}: Props) => {
  
    const { ticket_number, date } = useTerminalTicket();
  const {
    data, fetchNextPage, hasNextPage, isFetchingNextPage, isLoading,
  } = useInfiniteBetsByTicketNumber({
    date, ticket_number, limit: 50,
  });

  const bets = useMemo(() => {
    const flat = data?.pages.flatMap((p) => p.data) ?? [];
    return dedupe(flat, (b: IBetEntityFront) => String(b.bet_id));
  }, [data]);

  const rootRef = useRef<HTMLDivElement | null>(null);

  const { setTriggerRef, triggerIndex } = useInfiniteScroll({
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
    root: rootRef.current,
    offsetFromEnd: 30, 
    totalItems: bets.length,
  });

  if (isLoading) return <SkeletonList />;

  return (
    <div className="flex-1 min-h-40">
      <p>{`Jugadas | Cantidad jugadas: ${count} | Total: $${amount}`}</p>
      <div className="rounded-md border">
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

        <div ref={rootRef} className={`overflow-y-auto ${maxBodyHeightClass}`}>
          <Table className="table-fixed">
            <TableBody>
              {bets.map((bet, index) => (
                <BetRowMemoized
                  key={String(bet.bet_id)}
                  bet={bet}
                  triggerRef={index === triggerIndex ? setTriggerRef : undefined}
                />
              ))}

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

              {!hasNextPage && bets.length > 0 && (
                <TableRow>
                  <TableCell colSpan={5} className="text-center p-4">
                    <span className="text-sm text-muted-foreground">
                      No hay más jugadas ({count} total)
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
