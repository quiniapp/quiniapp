import { ReactNode } from 'react';
import { toast } from 'react-hot-toast';
import { Copy, Gift } from 'lucide-react';
import {
  IPollaBetListItem,
  POLLA_NUMBERS_REQUIRED,
  isPublicPollaBet,
} from '@helper/polla/types/game.type';
import { BetNumbers } from '@/components/BetNumbers';
import { EmptyState } from '@/components/PageHeader';
import { InfiniteList } from '@/components/InfiniteList';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { betNumberClass, hitTitle } from '@/lib/betNumbers';
import { cn } from '@/lib/utils';
import { cashierLabel, clientLabel, fmtDate } from './format';

const SLOTS = Array.from({ length: POLLA_NUMBERS_REQUIRED }, (_, i) => i);

/** Tickets elegidos para repetir sin cargo (Administrar, edición finalizada). */
export interface BetsSelection {
  canSelect: (row: IPollaBetListItem) => boolean;
  selected: Set<string>;
  onToggle: (betId: string, checked: boolean) => void;
}

interface BetsListProps {
  rows: IPollaBetListItem[];
  totalCount: number;
  isFetching: boolean;
  hasNextPage: boolean;
  isFetchingNextPage: boolean;
  fetchNextPage: () => void;
  /** Veces que se repitió sin cargo cada ticket (Administrar). */
  freeRepeats?: Record<string, number>;
  /** Acciones de cada jugada (Administrar). Sin esto no hay columna de acciones. */
  renderActions?: (row: IPollaBetListItem) => ReactNode;
  selection?: BetsSelection;
  /** Botón para copiar el número de ticket (pasador y superiores). */
  canCopyTicket?: boolean;
}

const CopyTicketButton = ({ ticketNumber }: { ticketNumber: string }) => (
  <Button
    type="button"
    size="icon"
    variant="ghost"
    className="size-7 shrink-0"
    title="Copiar número de ticket"
    aria-label={`Copiar el ticket ${ticketNumber}`}
    onClick={async () => {
      try {
        await navigator.clipboard.writeText(ticketNumber);
        toast.success('Número de ticket copiado');
      } catch {
        toast.error('No se pudo copiar el número de ticket');
      }
    }}
  >
    <Copy className="size-3.5" />
  </Button>
);

const BetStatus = ({ row, freeRepeats }: { row: IPollaBetListItem; freeRepeats: number }) => {
  let main;
  if (row.winner) {
    main = <Badge variant="success">Ganadora {fmtDate(row.hit_date)}</Badge>;
  } else if (isPublicPollaBet(row)) {
    main = row.is_mine ? (
      <Badge variant="outline">Mía</Badge>
    ) : (
      <Badge variant="secondary">Jugando</Badge>
    );
  } else {
    main = <span className="text-xs text-muted-foreground">{fmtDate(row.load_date)}</span>;
  }

  return (
    <span className="flex flex-wrap items-center gap-1">
      {main}
      {row.is_free && <Badge variant="outline">Sin cargo</Badge>}
      {freeRepeats > 0 && (
        <Badge variant="secondary" title="Veces que se repitió sin cargo">
          <Gift className="mr-1 h-3 w-3" />
          {freeRepeats}
        </Badge>
      )}
    </span>
  );
};

/**
 * Listado de jugadas de Jugadas y Administrar jugadas: tarjetas en mobile y
 * planilla en desktop, con scroll infinito. Las acciones y la selección solo
 * aparecen si la pantalla las pasa.
 */
export const BetsList = ({
  rows,
  totalCount,
  isFetching,
  hasNextPage,
  isFetchingNextPage,
  fetchNextPage,
  freeRepeats = {},
  renderActions,
  selection,
  canCopyTicket = false,
}: BetsListProps) => {
  if (rows.length === 0) {
    return <EmptyState message={isFetching ? 'Cargando…' : 'No hay jugadas para mostrar'} />;
  }

  const selectBox = (row: IPollaBetListItem, className?: string) =>
    selection?.canSelect(row) && (
      <Checkbox
        checked={selection.selected.has(row.polla_bet_id)}
        onCheckedChange={(checked) => selection.onToggle(row.polla_bet_id, checked === true)}
        aria-label={`Elegir el ticket ${row.ticket_number}`}
        className={className}
      />
    );

  return (
    <InfiniteList
      totalCount={totalCount}
      loadedCount={rows.length}
      hasNextPage={hasNextPage}
      isFetchingNextPage={isFetchingNextPage}
      fetchNextPage={fetchNextPage}
    >
      {/* Mobile: tarjetas. Una tabla de 16 columnas en 320px obliga a
          scrollear de costado para leer una sola jugada. */}
      <ul className="flex flex-col gap-2 md:hidden">
        {rows.map((row) => (
          <li key={row.polla_bet_id} className="rounded-md border bg-card p-3 text-card-foreground">
            <div className="flex items-start justify-between gap-2">
              {selectBox(row, 'mt-1')}
              <div className="min-w-0 flex-1">
                <p className="flex items-center gap-1 font-mono text-xs text-muted-foreground">
                  <span className="truncate">{row.ticket_number}</span>
                  {canCopyTicket && <CopyTicketButton ticketNumber={row.ticket_number} />}
                </p>
                <p className="truncate text-sm">
                  {row.group_name && (
                    <span className="text-muted-foreground">{row.group_name} · </span>
                  )}
                  {cashierLabel(row)}
                  {clientLabel(row) && <span className="font-semibold"> · {clientLabel(row)}</span>}
                </p>
              </div>
              <Badge variant="success" className="shrink-0 text-sm tabular-nums">
                {row.hits}
              </Badge>
            </div>

            <div className="mt-2">
              <BetNumbers numbers={row.numbers} hitDates={row.hit_dates} />
            </div>

            <div className="mt-2 flex items-center justify-between gap-2">
              <BetStatus row={row} freeRepeats={freeRepeats[row.polla_bet_id] ?? 0} />
              {renderActions && <div className="flex gap-1">{renderActions(row)}</div>}
            </div>
          </li>
        ))}
      </ul>

      {/* Desktop: planilla con un casillero por número; los acertados en
          amarillo. */}
      <div className="hidden rounded-md border bg-card text-card-foreground md:block">
        <Table>
          <TableHeader>
            <TableRow>
              {selection && <TableHead className="w-8" />}
              <TableHead>Ticket</TableHead>
              <TableHead>Coord</TableHead>
              <TableHead>Pasador</TableHead>
              <TableHead>Cliente</TableHead>
              <TableHead className="text-center">Aciertos</TableHead>
              {SLOTS.map((slot) => (
                <TableHead key={slot} className="w-10 text-center">
                  {slot + 1}
                </TableHead>
              ))}
              <TableHead>Estado</TableHead>
              {renderActions && <TableHead className="text-right">Acciones</TableHead>}
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((row) => (
              <TableRow key={row.polla_bet_id}>
                {selection && <TableCell>{selectBox(row)}</TableCell>}
                <TableCell className="font-mono text-xs">
                  <span className="flex items-center gap-1 whitespace-nowrap">
                    {row.ticket_number}
                    {canCopyTicket && <CopyTicketButton ticketNumber={row.ticket_number} />}
                  </span>
                </TableCell>
                <TableCell>{row.group_name ?? ''}</TableCell>
                <TableCell>{cashierLabel(row)}</TableCell>
                <TableCell className="font-medium">{clientLabel(row)}</TableCell>
                <TableCell className="text-center">
                  <Badge variant="success" className="tabular-nums">
                    {row.hits}
                  </Badge>
                </TableCell>
                {SLOTS.map((slot) => {
                  const hitDate = row.hit_dates?.[slot] ?? null;
                  return (
                    <TableCell
                      key={slot}
                      title={hitTitle(hitDate)}
                      className={cn(
                        'border-l text-center font-mono text-sm tabular-nums',
                        hitDate && betNumberClass(true)
                      )}
                    >
                      {row.numbers[slot]}
                    </TableCell>
                  );
                })}
                <TableCell>
                  <BetStatus row={row} freeRepeats={freeRepeats[row.polla_bet_id] ?? 0} />
                </TableCell>
                {renderActions && (
                  <TableCell>
                    <div className="flex justify-end gap-1">{renderActions(row)}</div>
                  </TableCell>
                )}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </InfiniteList>
  );
};
