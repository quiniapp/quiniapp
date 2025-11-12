// termina-ticket-play-table.tsx
import {
  Table, TableHeader, TableHead, TableRow, TableBody, TableCell,
} from '@/components/ui/table';
import SkeletonList from '@/components/skeletons/skeleton-list';
import { IBetEntityFront } from '@helper/types/bet.type';
import { useEffect, useMemo, useRef } from 'react';
import { Loader2 } from 'lucide-react';
import { useInfiniteBetsByTicketNumber } from '@/hooks/fetchs/plays/useInfiniteBetsByTicketNumber';

interface Props {
  ticket_number?: string;
  date: string;
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

const TerminalTicketPlayTable = ({
  ticket_number,
  date,
  amount,
  count,
  maxBodyHeightClass = 'max-h-[50vh]',
}: Props) => {
  const {
    data, fetchNextPage, hasNextPage, isFetchingNextPage, isLoading,
  } = useInfiniteBetsByTicketNumber({
    date, ticket_number, limit: 100,
  });

  const bets = useMemo(() => {
    const flat = data?.pages.flatMap((p) => p.data) ?? [];
    return dedupe(flat, (b: IBetEntityFront) => String(b.bet_id));
  }, [data]);


  const rootRef = useRef<HTMLDivElement | null>(null);
  const sentinelRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const root = rootRef.current;
    const target = sentinelRef.current;
    if (!root || !target) return;
    const io = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting && hasNextPage && !isFetchingNextPage) fetchNextPage?.();
      },
      { root, rootMargin: '0px 0px 800px 0px', threshold: 0 }
    );
    io.observe(target);
    return () => io.disconnect();
  }, [hasNextPage, isFetchingNextPage, fetchNextPage]);

  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;
    if (root.scrollHeight <= root.clientHeight && hasNextPage && !isFetchingNextPage) {
      fetchNextPage?.();
    }
  }, [bets.length, hasNextPage, isFetchingNextPage, fetchNextPage]);

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
              {bets.map((bet) => (
                <TableRow key={String(bet.bet_id)}>
                  <TableCell className="truncate">{bet.number}</TableCell>
                  <TableCell className="whitespace-nowrap">${bet.amount}</TableCell>
                  <TableCell className="truncate">{bet.lottery.name}</TableCell>
                  <TableCell className="truncate">{bet.bet_type}</TableCell>
                  <TableCell className="truncate">{bet.schedule.name}</TableCell>
                </TableRow>
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

          {hasNextPage && !isFetchingNextPage && <div ref={sentinelRef} className="h-px w-full" />}
        </div>
      </div>
    </div>
  );
};

export default TerminalTicketPlayTable;
