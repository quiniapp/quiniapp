// terminal-ticket-matches-table.tsx
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
import { useMemo, useRef } from 'react';
import { Loader2 } from 'lucide-react';
import { useInfiniteBetsByTicketNumber } from '@/hooks/fetchs/plays/useInfiniteBetsByTicketNumber';
import { betTypeAndPlaceLabel } from '@helper/functions/betTypeDictionary';
import { useInfiniteScroll } from '@/hooks/useInfiniteScroll';

interface Props {
  ticket_number?: string;
  date: string;
  maxBodyHeightClass?: string;
  prize: number;
  winners_count: number;
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

const TerminalTicketMatchesTable = ({
  ticket_number,
  date,
  maxBodyHeightClass = 'max-h-[50vh]',
  prize,
  winners_count,
}: Props) => {
  const { data, fetchNextPage, hasNextPage, isFetchingNextPage, isLoading } =
    useInfiniteBetsByTicketNumber({
      date,
      ticket_number,
      winners: 'true',
      limit: 150,
    });

  const bets = useMemo(() => {
    const flat = data?.pages.flatMap((p) => p.data) ?? [];
    return dedupe(flat, (b: IBetEntityFront) => String(b.bet_id));
  }, [data]);

  const rootRef = useRef<HTMLDivElement | null>(null);

  // Hook centralizado de infinite scroll - carga cuando faltan 75 filas para el final
  const { setTriggerRef, triggerIndex } = useInfiniteScroll({
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
    root: rootRef.current,
    offsetFromEnd: 75, // Dispara cuando faltan 75 filas para llegar al final
    totalItems: bets.length,
  });

  if (isLoading) return <SkeletonList />;

  return (
    <div className="flex-1 min-h-40">
      <p>{`Aciertos | Cantidad aciertos: ${winners_count} | Aciertos: $${prize}`}</p>
      <div className="rounded-md border">
        <Table className="min-w-full table-fixed">
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
          <Table className="min-w-full table-fixed">
            <TableBody>
              {bets.map((bet, index) => (
                <TableRow
                  key={String(bet.bet_id)}
                  ref={index === triggerIndex ? setTriggerRef : undefined}
                >
                  <TableCell>{bet.number}{`${bet?.with? ` - ${bet.with}` : ''}`}</TableCell>
                  <TableCell>${bet.amount}</TableCell>
                  <TableCell>{bet.lottery.name}</TableCell>
                  <TableCell>{betTypeAndPlaceLabel(bet.bet_type,bet.place,bet.position)}</TableCell>
                  <TableCell>{bet.schedule.name}</TableCell>
                </TableRow>
              ))}

              {isFetchingNextPage && (
                <TableRow>
                  <TableCell colSpan={5} className="text-center p-4">
                    <div className="flex items-center justify-center">
                      <Loader2 className="w-5 h-5 animate-spin text-primary mr-2" />
                      <span className="text-sm text-muted-foreground">
                        Cargando más aciertos...
                      </span>
                    </div>
                  </TableCell>
                </TableRow>
              )}

              {!hasNextPage && bets.length > 0 && (
                <TableRow>
                  <TableCell colSpan={5} className="text-center p-4">
                    <span className="text-sm text-muted-foreground">
                      No hay más aciertos ({winners_count} total)
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

export default TerminalTicketMatchesTable;
