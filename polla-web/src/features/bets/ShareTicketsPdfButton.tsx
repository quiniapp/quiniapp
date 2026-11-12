import { useState } from 'react';
import { toast } from 'react-hot-toast';
import dayjs from 'dayjs';
import { FileDown, LoaderCircle } from 'lucide-react';
import { POLLA_EXPORT_PAGE_SIZE } from '@helper/polla/config/session.config';
import { IPollaBetListItem, IPollaEditionEntityFront } from '@helper/polla/types/game.type';
import { useAuth } from '@/providers/AuthContext';
import { apiClient } from '@/lib/apiClient';
import { periodLabel } from '@/lib/accountPeriod';
import { filterSnapshot, pastDrawDays, snapshotAtDay } from '@/lib/betsSnapshot';
import { todayIso } from '@/lib/dates';
import { cn } from '@/lib/utils';
import { BACKEND_ROUTES } from '@/routes/backend-routes';
import { PollaPage, cleanParams } from '@/hooks/useApi';
import { Button } from '@/components/ui/button';
import { DateInput } from '@/components/ui/date-input';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { makeEditionTicketsPdf } from '@/functions/editionTicketsPDF';
import { sharePdf } from '@/functions/printPdf';
import { fetchOrganizationName } from '@/features/current-account/fetchers';
import { LoadRange } from './LoadDateFilter';

export interface TicketsPdfFilters {
  /** `public`: lo que muestra Jugadas (toda la organización). Sin esto, lo que administra el rol. */
  view?: 'public';
  /** "Mis jugadas" de Jugadas: el pasador, lo suyo y lo de sus jugadores; el resto, lo suyo. */
  mine?: boolean;
  cashier_polla_user_id?: string;
  /** Las de un jugador (filtro "Jugador" de Jugadas). */
  polla_user_id?: string;
  polla_group_id?: string;
  /** Nombre del jugador o identificador del ticket. */
  search?: string;
  /** `true`: ganadoras; `false`: no ganadoras. */
  winner?: boolean;
  /** Aciertos exactos separados por coma (`10,9`). */
  hits?: string;
  /** Días de carga (`YYYY-MM-DD`, los dos o ninguno). */
  load_from?: string;
  load_to?: string;
  sort?: 'hits' | 'recent';
}

type Progress =
  | { phase: 'idle' }
  | { phase: 'loading'; loaded: number; total: number }
  | { phase: 'building' };

const fmtCount = (n: number) => new Intl.NumberFormat('es-AR').format(n);

/**
 * Todas las jugadas de la edición con esos filtros, de a 1000 por keyset: una
 * edición puede tener miles de tickets.
 */
const fetchAllTickets = async (
  editionId: string,
  filters: TicketsPdfFilters,
  onProgress: (loaded: number, total: number) => void
) => {
  const rows: IPollaBetListItem[] = [];
  let cursor: string | undefined;
  let total = 0;

  do {
    const page = await apiClient.get<PollaPage<IPollaBetListItem>>(BACKEND_ROUTES.bet.base, {
      params: cleanParams({
        polla_edition_id: editionId,
        export: true,
        limit: POLLA_EXPORT_PAGE_SIZE,
        cursor,
        sort: filters.sort ?? 'hits',
        view: filters.view,
        mine: filters.mine ? 'true' : undefined,
        cashier_polla_user_id: filters.cashier_polla_user_id,
        polla_user_id: filters.polla_user_id,
        polla_group_id: filters.polla_group_id,
        search: filters.search,
        winner: filters.winner,
        hits: filters.hits,
        load_from: filters.load_from,
        load_to: filters.load_to,
      }),
    });

    // El COUNT viene solo en la primera página (sin cursor).
    if (!cursor) total = page.pagination.totalCount;
    rows.push(...page.data);
    onProgress(rows.length, Math.max(total, rows.length));
    cursor = page.next_cursor ?? undefined;
  } while (cursor);

  return rows;
};

/**
 * Qué entra al PDF:
 * - `list`: lo que se ve en la lista (Jugadas);
 * - `load`: los días de carga elegidos (Administrar jugadas);
 * - `snapshot`: la foto al cierre de un día de sorteo (R24).
 */
type PdfChoice =
  | { kind: 'list' }
  | { kind: 'load'; range: LoadRange | null }
  | { kind: 'snapshot'; day: string };

type ChoiceValue = 'list' | 'list-range' | 'today' | 'day' | 'all' | 'snapshot';

const drawDayLabel = (day: string, index: number) =>
  `Día ${index + 1} · ${dayjs(day).format('DD/MM')}`;

/**
 * Elegir qué tickets van al PDF. Con `loadChoices` (Administrar jugadas): hoy,
 * otra fecha de carga, todas o el rango de la lista. Sin eso (Jugadas): lo que
 * se ve en la lista. Si la edición ya empezó a sortearse, además "Al cierre de
 * un día de sorteo" (R24).
 */
const PdfChoiceDialog = ({
  loadChoices,
  listRange,
  drawDays,
  onConfirm,
  onClose,
}: {
  loadChoices: boolean;
  listRange: LoadRange | null;
  drawDays: string[];
  onConfirm: (choice: PdfChoice) => void;
  onClose: () => void;
}) => {
  const today = todayIso();
  const [choice, setChoice] = useState<ChoiceValue>(() => {
    if (!loadChoices) return 'list';
    return listRange ? 'list-range' : 'today';
  });
  const [day, setDay] = useState(today);
  // La foto arranca en el último día sorteado.
  const [snapshotDay, setSnapshotDay] = useState(drawDays[drawDays.length - 1] ?? '');

  const options: { value: ChoiceValue; label: string }[] = loadChoices
    ? [
        ...(listRange
          ? [
              {
                value: 'list-range' as const,
                label: `Las de la lista (cargadas ${periodLabel(listRange.from, listRange.to)})`,
              },
            ]
          : []),
        { value: 'today', label: `Las de hoy (${dayjs(today).format('DD/MM')})` },
        { value: 'day', label: 'Las de otra fecha' },
        { value: 'all', label: 'Todas las fechas' },
      ]
    : [{ value: 'list', label: 'Como están ahora' }];
  if (drawDays.length > 0) {
    options.push({ value: 'snapshot', label: 'Al cierre de un día de sorteo' });
  }

  const handleConfirm = () => {
    if (choice === 'list') onConfirm({ kind: 'list' });
    else if (choice === 'list-range') onConfirm({ kind: 'load', range: listRange });
    else if (choice === 'today') onConfirm({ kind: 'load', range: { from: today, to: today } });
    else if (choice === 'day') onConfirm({ kind: 'load', range: { from: day, to: day } });
    else if (choice === 'all') onConfirm({ kind: 'load', range: null });
    else onConfirm({ kind: 'snapshot', day: snapshotDay });
  };

  return (
    <Dialog open onOpenChange={(next) => !next && onClose()}>
      <DialogContent className="max-w-[95vw] sm:max-w-[420px]">
        <DialogHeader>
          <DialogTitle>Compartir PDF</DialogTitle>
          <DialogDescription>
            {loadChoices
              ? '¿De qué día son las jugadas que imprimís? Los demás filtros de la lista se aplican igual.'
              : '¿Qué jugadas imprimís? Los filtros de la lista se aplican igual.'}
          </DialogDescription>
        </DialogHeader>

        <div role="radiogroup" aria-label="Qué jugadas" className="flex flex-col gap-2">
          {options.map((option) => {
            const selected = choice === option.value;
            return (
              <button
                key={option.value}
                type="button"
                role="radio"
                aria-checked={selected}
                onClick={() => setChoice(option.value)}
                className={cn(
                  'rounded-md border-2 px-3 py-2 text-left text-sm transition-colors',
                  'focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50',
                  selected ? 'border-primary font-medium' : 'border-border hover:border-primary/60'
                )}
              >
                {option.label}
              </button>
            );
          })}
        </div>

        {choice === 'day' && (
          <DateInput
            id="pdf-load-day"
            aria-label="Fecha de carga"
            value={day}
            max={today}
            onValueChange={setDay}
          />
        )}

        {choice === 'snapshot' && (
          <div className="flex flex-col gap-1">
            <Select value={snapshotDay} onValueChange={setSnapshotDay}>
              <SelectTrigger aria-label="Día de sorteo" className="w-full">
                <SelectValue placeholder="Elegí el día" />
              </SelectTrigger>
              <SelectContent>
                {drawDays.map((drawDay, index) => (
                  <SelectItem key={drawDay} value={drawDay}>
                    {drawDayLabel(drawDay, index)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">
              Los tickets cargados hasta ese día, con los aciertos de los sorteos hasta ese día.
            </p>
          </div>
        )}

        <DialogFooter>
          <Button type="button" variant="outline" onClick={onClose}>
            Cancelar
          </Button>
          <Button
            type="button"
            onClick={handleConfirm}
            disabled={(choice === 'day' && !day) || (choice === 'snapshot' && !snapshotDay)}
          >
            <FileDown />
            Compartir PDF
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

/**
 * "Compartir PDF": baja todas las jugadas de la edición (con los filtros que se
 * eligieron), arma el PDF para imprimir en blanco y negro y lo comparte (mobile)
 * o lo descarga (desktop). Mientras tanto muestra un spinner con el progreso.
 * La API lo acota a lo que administra cada rol, como Administrar jugadas; con
 * `view: 'public'` (Jugadas) trae lo mismo que la lista: toda la organización.
 * Con `pickLoadDate` (Administrar jugadas) antes se elige de qué día son las
 * jugadas: reemplaza `load_from`/`load_to` de `filters` y se suma al final de
 * `filtersLabel`. Si la edición ya empezó a sortearse, también se puede pedir
 * la foto al cierre de un día de sorteo (R24).
 */
export const ShareTicketsPdfButton = ({
  edition,
  title,
  filters = {},
  filtersLabel,
  pickLoadDate = false,
  className,
}: {
  edition: IPollaEditionEntityFront;
  /** Nombre y sorteos de la edición (`pollaEditionTitle`). */
  title: string;
  filters?: TicketsPdfFilters;
  filtersLabel?: string;
  pickLoadDate?: boolean;
  className?: string;
}) => {
  const { organizationId } = useAuth();
  const [progress, setProgress] = useState<Progress>({ phase: 'idle' });
  const [picking, setPicking] = useState(false);
  const busy = progress.phase !== 'idle';
  const drawDays = pastDrawDays(edition, todayIso());

  const generate = async (
    pdfFilters: TicketsPdfFilters,
    pdfFiltersLabel?: string,
    snapshotDay?: string
  ) => {
    setProgress({ phase: 'loading', loaded: 0, total: edition.bets_count ?? 0 });
    try {
      // La foto pide toda la edición, sin los filtros de resultado ni de carga:
      // `snapshotAtDay` deja lo cargado hasta ese día, y ganadoras y aciertos
      // se miran con lo que había al cierre de ese día. (La API pide las dos
      // puntas del rango de carga, y como mucho 62 días.)
      const fetchFilters = snapshotDay
        ? {
            ...pdfFilters,
            winner: undefined,
            hits: undefined,
            load_from: undefined,
            load_to: undefined,
          }
        : pdfFilters;

      const [fetched, orgName] = await Promise.all([
        fetchAllTickets(edition.polla_edition_id, fetchFilters, (loaded, total) =>
          setProgress({ phase: 'loading', loaded, total })
        ),
        fetchOrganizationName(organizationId),
      ]);

      setProgress({ phase: 'building' });
      // Armar miles de filas bloquea el hilo: antes se deja pintar el spinner.
      await new Promise((resolve) => setTimeout(resolve, 0));

      const rows = snapshotDay
        ? filterSnapshot(snapshotAtDay(fetched, snapshotDay, pdfFilters.sort ?? 'hits'), {
            winner: pdfFilters.winner,
            hits: pdfFilters.hits,
          })
        : fetched;

      const { blob, fileName } = await makeEditionTicketsPdf({
        rows,
        edition,
        title,
        orgName,
        filtersLabel: pdfFiltersLabel,
        snapshotDay,
      });

      await sharePdf(blob, fileName, `Tickets de la Polla ${title}`);
    } catch {
      toast.error('No se pudo generar el PDF de tickets');
    } finally {
      setProgress({ phase: 'idle' });
    }
  };

  const handleClick = () => {
    if (pickLoadDate || drawDays.length > 0) setPicking(true);
    else void generate(filters, filtersLabel);
  };

  const handlePicked = (choice: PdfChoice) => {
    setPicking(false);
    if (choice.kind === 'list') {
      void generate(filters, filtersLabel);
    } else if (choice.kind === 'load') {
      const { range } = choice;
      const loadLabel = range
        ? `cargadas ${periodLabel(range.from, range.to)}`
        : 'todas las fechas';
      void generate(
        { ...filters, load_from: range?.from, load_to: range?.to },
        [filtersLabel, loadLabel].filter(Boolean).join(' · ')
      );
    } else {
      const dayLabel = `al cierre del ${dayjs(choice.day).format('DD/MM/YYYY')}`;
      void generate(filters, [filtersLabel, dayLabel].filter(Boolean).join(' · '), choice.day);
    }
  };

  let label = 'Compartir PDF';
  if (progress.phase === 'loading') {
    label = progress.total
      ? `Cargando ${fmtCount(progress.loaded)} de ${fmtCount(progress.total)}…`
      : 'Cargando tickets…';
  } else if (progress.phase === 'building') {
    label = 'Generando PDF…';
  }

  const listRange =
    filters.load_from && filters.load_to ? { from: filters.load_from, to: filters.load_to } : null;

  return (
    <>
      <Button
        type="button"
        variant="outline"
        className={className}
        onClick={handleClick}
        disabled={busy}
        aria-busy={busy}
      >
        {busy ? <LoaderCircle className="animate-spin" /> : <FileDown />}
        {label}
      </Button>

      {picking && (
        <PdfChoiceDialog
          loadChoices={pickLoadDate}
          listRange={listRange}
          drawDays={drawDays}
          onConfirm={handlePicked}
          onClose={() => setPicking(false)}
        />
      )}
    </>
  );
};
