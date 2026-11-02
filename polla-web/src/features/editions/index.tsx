import { useMemo, useState } from 'react';
import dayjs from 'dayjs';
import { toast } from 'react-hot-toast';
import { CalendarPlus, Pencil, Trash2 } from 'lucide-react';
import { newPollaEditionSchema, updatePollaEditionSchema } from '@helper/polla/schemas/game.schema';
import {
  IPollaEditionEntityFront,
  POLLA_EDITION_PERIOD,
  POLLA_EDITION_PERIOD_LABEL,
  POLLA_EDITION_STATUS,
  pollaEditionPeriod,
} from '@helper/polla/types/game.type';
import { useAuth } from '@/providers/AuthContext';
import { useEditionList } from '@/hooks/fetchs/usePollaData';
import { useLotteries, useSchedules } from '@/hooks/fetchs/useCatalogs';
import {
  useCreateEdition,
  useDeleteEdition,
  useUpdateEdition,
} from '@/hooks/mutations/usePollaMutations';
import { EmptyState, PageHeader } from '@/components/PageHeader';
import { InfiniteList } from '@/components/InfiniteList';
import { flattenPages } from '@/hooks/useApi';
import { todayIso } from '@/lib/dates';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { DateInput } from '@/components/ui/date-input';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';

const fmtDate = (value?: string | null) => (value ? dayjs(value).format('DD-MM-YYYY') : '-');
/** `HH:mm:ss` de la base → `HH:mm`. */
const fmtTime = (value?: string | null) => (value ? value.slice(0, 5) : '');
const fmtMoney = (value: number) =>
  new Intl.NumberFormat('es-AR', { minimumFractionDigits: 2 }).format(Number(value));

const emptyForm = {
  polla_lottery_id: '',
  polla_schedule_id: '',
  name: '',
  start_date: '',
  end_date: '',
  load_limit_date: '',
  /** Pasada esta hora del día de cierre, pasadores y jugadores ya no cargan. */
  load_limit_time: '21:00',
  pool_amount: '',
  surprise_pool_amount: '',
  ticket_price: '',
};

type EditionForm = typeof emptyForm;

const formOf = (edition: IPollaEditionEntityFront): EditionForm => ({
  polla_lottery_id: edition.polla_lottery_id,
  polla_schedule_id: edition.polla_schedule_id,
  name: edition.name ?? '',
  start_date: edition.start_date,
  end_date: edition.end_date,
  load_limit_date: edition.load_limit_date,
  load_limit_time: fmtTime(edition.load_limit_time),
  pool_amount: String(Number(edition.pool_amount)),
  surprise_pool_amount: String(Number(edition.surprise_pool_amount ?? 0)),
  ticket_price: String(Number(edition.ticket_price)),
});

/** Acepta coma decimal; vacío es 0. */
const parseMoney = (raw: string) => Number(raw.replace(',', '.') || 0);

interface EditionDialogProps {
  /** `null` = edición nueva. */
  edition: IPollaEditionEntityFront | null;
  /** Abre para extender una edición que terminó sin ganador. */
  extending?: boolean;
  lotteries: { polla_lottery_id: string; name: string }[];
  schedules: { polla_schedule_id: string; name: string; time: string }[];
  organizationId: string | null;
  onClose: () => void;
}

/**
 * Alta y edición de una edición (superadmin+): precio (vale para las jugadas
 * nuevas, cada una guarda el suyo), fechas, horas, pozo y pozo sorpresa.
 * Extender el fin de una edición que terminó sin ganador la vuelve a poner en
 * juego (la carga no se reabre). Con ganador solo se renombra; con sorteos
 * cargados no se cambian quiniela, turno ni inicio (lo controla la base y
 * avisa).
 */
const EditionDialog = ({
  edition,
  extending = false,
  lotteries,
  schedules,
  organizationId,
  onClose,
}: EditionDialogProps) => {
  const [form, setForm] = useState<EditionForm>(edition ? formOf(edition) : emptyForm);
  const { mutate: createEdition, isPending: isCreating } = useCreateEdition();
  const { mutate: updateEdition, isPending: isUpdating } = useUpdateEdition();
  const isPending = isCreating || isUpdating;
  const hasWinner = Boolean(edition?.winner_date);

  const handleSubmit = () => {
    const values = {
      ...form,
      name: form.name || null,
      pool_amount: parseMoney(form.pool_amount),
      surprise_pool_amount: parseMoney(form.surprise_pool_amount),
      ticket_price: parseMoney(form.ticket_price),
    };

    if (!edition) {
      const parsed = newPollaEditionSchema.safeParse({
        ...values,
        ...(organizationId ? { polla_organization_id: organizationId } : {}),
      });
      if (!parsed.success) {
        toast.error(parsed.error.errors[0]?.message ?? 'Revisá los datos');
        return;
      }
      createEdition(parsed.data, { onSuccess: onClose });
      return;
    }

    // Con ganador solo se renombra: mandar el resto haría que la base lo rechace.
    const parsed = updatePollaEditionSchema.safeParse(hasWinner ? { name: values.name } : values);
    if (!parsed.success) {
      toast.error(parsed.error.errors[0]?.message ?? 'Revisá los datos');
      return;
    }
    updateEdition({ id: edition.polla_edition_id, ...parsed.data }, { onSuccess: onClose });
  };

  const priceChanged =
    edition !== null && parseMoney(form.ticket_price) !== Number(edition.ticket_price);

  return (
    <Dialog open onOpenChange={(next) => !next && onClose()}>
      <DialogContent className="max-h-[90vh] max-w-[95vw] overflow-y-auto sm:max-w-[560px]">
        <DialogHeader>
          <DialogTitle>
            {!edition ? 'Nueva edición' : extending ? 'Extender edición' : 'Editar edición'}
          </DialogTitle>
          <DialogDescription>
            {hasWinner
              ? 'La edición ya tiene ganadores: solo se puede cambiar el nombre.'
              : extending
                ? 'Mové la fecha de fin para sumar sorteos (por ejemplo, el sábado). Los tickets siguen jugando y la carga no se reabre.'
                : 'El cierre de carga puede ser el mismo día del primer sorteo, antes de la hora del turno.'}
          </DialogDescription>
        </DialogHeader>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div className="flex flex-col gap-1">
            <Label>Quiniela</Label>
            <Select
              value={form.polla_lottery_id}
              onValueChange={(v) => setForm({ ...form, polla_lottery_id: v })}
              disabled={hasWinner}
            >
              <SelectTrigger>
                <SelectValue placeholder="Elegí" />
              </SelectTrigger>
              <SelectContent>
                {lotteries.map((l) => (
                  <SelectItem key={l.polla_lottery_id} value={l.polla_lottery_id}>
                    {l.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="flex flex-col gap-1">
            <Label>Turno (hora del sorteo)</Label>
            <Select
              value={form.polla_schedule_id}
              onValueChange={(v) => setForm({ ...form, polla_schedule_id: v })}
              disabled={hasWinner}
            >
              <SelectTrigger>
                <SelectValue placeholder="Elegí" />
              </SelectTrigger>
              <SelectContent>
                {schedules.map((s) => (
                  <SelectItem key={s.polla_schedule_id} value={s.polla_schedule_id}>
                    {s.name} · {fmtTime(s.time)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="flex flex-col gap-1 sm:col-span-2">
            <Label htmlFor="edition-name">Nombre (opcional)</Label>
            <Input
              id="edition-name"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
            />
          </div>

          <div className="flex flex-col gap-1">
            <Label htmlFor="edition-load-limit-date">Cierre de carga (fecha)</Label>
            <DateInput
              id="edition-load-limit-date"
              value={form.load_limit_date}
              onValueChange={(value) => setForm({ ...form, load_limit_date: value })}
              disabled={hasWinner}
            />
          </div>
          <div className="flex flex-col gap-1">
            <Label htmlFor="edition-load-limit-time">Cierre de carga (hora)</Label>
            <Input
              id="edition-load-limit-time"
              type="time"
              value={form.load_limit_time}
              onChange={(e) => setForm({ ...form, load_limit_time: e.target.value })}
              disabled={hasWinner}
            />
          </div>
          <div className="flex flex-col gap-1">
            <Label htmlFor="edition-start-date">Inicio</Label>
            <DateInput
              id="edition-start-date"
              value={form.start_date}
              onValueChange={(value) => setForm({ ...form, start_date: value })}
              disabled={hasWinner}
            />
          </div>
          <div className="flex flex-col gap-1">
            <Label htmlFor="edition-end-date">Fin</Label>
            <DateInput
              id="edition-end-date"
              value={form.end_date}
              onValueChange={(value) => setForm({ ...form, end_date: value })}
              disabled={hasWinner}
            />
          </div>

          <div className="flex flex-col gap-1">
            <Label htmlFor="edition-pool">Pozo</Label>
            <Input
              id="edition-pool"
              inputMode="decimal"
              value={form.pool_amount}
              onChange={(e) => setForm({ ...form, pool_amount: e.target.value })}
              disabled={hasWinner}
            />
          </div>
          <div className="flex flex-col gap-1">
            <Label htmlFor="edition-surprise">Pozo sorpresa</Label>
            <Input
              id="edition-surprise"
              inputMode="decimal"
              placeholder="0"
              value={form.surprise_pool_amount}
              onChange={(e) => setForm({ ...form, surprise_pool_amount: e.target.value })}
              disabled={hasWinner}
            />
          </div>
          <div className="flex flex-col gap-1">
            <Label htmlFor="edition-ticket-price">Valor del ticket</Label>
            <Input
              id="edition-ticket-price"
              inputMode="decimal"
              value={form.ticket_price}
              onChange={(e) => setForm({ ...form, ticket_price: e.target.value })}
              disabled={hasWinner}
            />
            {priceChanged && (edition?.bets_count ?? 0) > 0 && (
              <p className="text-xs text-muted-foreground">
                Vale para las jugadas que se carguen desde ahora: las cargadas conservan su precio.
              </p>
            )}
          </div>
        </div>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={onClose}>
            Cancelar
          </Button>
          <Button type="button" onClick={handleSubmit} disabled={isPending}>
            {isPending ? 'Guardando…' : edition ? 'Guardar' : 'Crear'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

/** Pozo de la edición, con el sorpresa destacado si hay. */
const PoolAmount = ({ edition }: { edition: IPollaEditionEntityFront }) => (
  <>
    ${fmtMoney(edition.pool_amount)}
    {Number(edition.surprise_pool_amount ?? 0) > 0 && (
      <span className="block text-xs font-semibold text-success">
        + sorpresa ${fmtMoney(edition.surprise_pool_amount)}
      </span>
    )}
  </>
);

type DialogState = { edition: IPollaEditionEntityFront | null; extending?: boolean };

const ALL_PERIODS = Object.values(POLLA_EDITION_PERIOD);
const DEFAULT_PERIODS = [POLLA_EDITION_PERIOD.UPCOMING, POLLA_EDITION_PERIOD.PLAYING];

export const EditionsPage = () => {
  const { organizationId } = useAuth();
  const [dialog, setDialog] = useState<DialogState | null>(null);
  const [periods, setPeriods] = useState<POLLA_EDITION_PERIOD[]>(DEFAULT_PERIODS);

  // Ninguno o los tres tildados es lo mismo: sin filtro, todas.
  const periodsFilter =
    periods.length > 0 && periods.length < ALL_PERIODS.length ? periods.join(',') : undefined;

  const { data, fetchNextPage, hasNextPage, isFetchingNextPage, isFetching } = useEditionList({
    polla_organization_id: organizationId ?? undefined,
    periods: periodsFilter,
  });

  const { rows, totalCount } = flattenPages(data?.pages);
  const { data: lotteries } = useLotteries({ polla_organization_id: organizationId ?? undefined });
  const { data: schedules } = useSchedules({ polla_organization_id: organizationId ?? undefined });

  const { mutate: deleteEdition } = useDeleteEdition();

  const lotteryById = useMemo(
    () => new Map(lotteries?.data.map((l) => [l.polla_lottery_id, l.name])),
    [lotteries]
  );
  const scheduleById = useMemo(
    () => new Map(schedules?.data.map((s) => [s.polla_schedule_id, s.name])),
    [schedules]
  );

  /** El orden de la lista queda fijo (el de `ALL_PERIODS`) para no duplicar la query. */
  const togglePeriod = (period: POLLA_EDITION_PERIOD, checked: boolean) =>
    setPeriods((prev) => ALL_PERIODS.filter((p) => (p === period ? checked : prev.includes(p))));

  const today = todayIso();

  const editionTitle = (edition: IPollaEditionEntityFront) =>
    `${lotteryById.get(edition.polla_lottery_id) ?? '-'} · ${
      scheduleById.get(edition.polla_schedule_id) ?? '-'
    }${edition.name ? ` · ${edition.name}` : ''}`;

  const renderStatus = (edition: IPollaEditionEntityFront) => {
    const period = pollaEditionPeriod(edition, today);
    if (period === POLLA_EDITION_PERIOD.UPCOMING) {
      return <Badge variant="secondary">Futura</Badge>;
    }
    if (period === POLLA_EDITION_PERIOD.PLAYING) return <Badge>Jugando</Badge>;
    return (
      <Badge variant="outline">
        Cerrada {edition.winner_date ? `· ${fmtDate(edition.winner_date)}` : 'sin ganador'}
      </Badge>
    );
  };

  /** Terminó sin ganador: se puede extender (por ejemplo, al sábado). */
  const canExtend = (edition: IPollaEditionEntityFront) =>
    edition.status === POLLA_EDITION_STATUS.FINISHED && !edition.winner_date;

  const renderActions = (edition: IPollaEditionEntityFront) => (
    <div className="flex justify-end gap-1">
      {canExtend(edition) && (
        <Button
          type="button"
          size="sm"
          variant="outline"
          onClick={() => setDialog({ edition, extending: true })}
        >
          <CalendarPlus />
          Extender
        </Button>
      )}
      <Button
        type="button"
        size="icon"
        variant="ghost"
        title="Editar"
        aria-label={`Editar la edición ${editionTitle(edition)}`}
        onClick={() => setDialog({ edition })}
      >
        <Pencil />
      </Button>
      <Button
        type="button"
        size="icon"
        variant="ghost"
        title="Eliminar"
        aria-label={`Eliminar la edición ${editionTitle(edition)}`}
        onClick={() => {
          if (
            window.confirm(
              '¿Eliminar la edición? Se anulan todas sus jugadas y salen de la cuenta corriente.'
            )
          ) {
            deleteEdition({ id: edition.polla_edition_id });
          }
        }}
      >
        <Trash2 />
      </Button>
    </div>
  );

  return (
    <div>
      <PageHeader
        description="Una edición por quiniela, turno y semana. El pozo lo definís vos y le podés sumar un pozo sorpresa mientras no haya ganador."
        actions={
          <Button type="button" onClick={() => setDialog({ edition: null })}>
            Nueva edición
          </Button>
        }
      />

      <div
        role="group"
        aria-label="Mostrar ediciones"
        className="mb-3 flex flex-wrap items-center gap-x-5 gap-y-2"
      >
        {ALL_PERIODS.map((period) => (
          <div key={period} className="flex items-center gap-2">
            <Checkbox
              id={`edition-period-${period}`}
              checked={periods.includes(period)}
              onCheckedChange={(checked) => togglePeriod(period, checked === true)}
            />
            <Label htmlFor={`edition-period-${period}`} className="cursor-pointer py-1">
              {POLLA_EDITION_PERIOD_LABEL[period]}
            </Label>
          </div>
        ))}
      </div>

      {rows.length === 0 ? (
        <EmptyState
          message={
            isFetching
              ? 'Cargando…'
              : periodsFilter
                ? 'No hay ediciones para los filtros elegidos'
                : 'Todavía no hay ediciones'
          }
        />
      ) : (
        <InfiniteList
          totalCount={totalCount}
          loadedCount={rows.length}
          hasNextPage={Boolean(hasNextPage)}
          isFetchingNextPage={isFetchingNextPage}
          fetchNextPage={fetchNextPage}
        >
          {/* Mobile: tarjetas. La tabla tiene 8 columnas y obliga a scrollear
              de costado. */}
          <ul className="flex flex-col gap-2 md:hidden">
            {rows.map((edition) => (
              <li
                key={edition.polla_edition_id}
                className="rounded-md border bg-card p-3 text-card-foreground"
              >
                <div className="flex items-start justify-between gap-2">
                  <p className="min-w-0 break-words font-medium">{editionTitle(edition)}</p>
                  <div className="-mr-2 -mt-2 shrink-0">{renderActions(edition)}</div>
                </div>
                {/* El badge va con la semana: al lado del título le comía el
                    ancho y partía las fechas. */}
                <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1">
                  {renderStatus(edition)}
                  <span className="whitespace-nowrap text-xs text-muted-foreground">
                    {fmtDate(edition.start_date)} al {fmtDate(edition.end_date)}
                  </span>
                </div>
                <dl className="mt-2 grid grid-cols-2 gap-x-4 gap-y-1 text-sm">
                  <dt className="text-muted-foreground">Cierre</dt>
                  <dd className="text-right tabular-nums">
                    {fmtDate(edition.load_limit_date)} {fmtTime(edition.load_limit_time)}
                  </dd>
                  <dt className="text-muted-foreground">Pozo</dt>
                  <dd className="text-right tabular-nums">
                    <PoolAmount edition={edition} />
                  </dd>
                  <dt className="text-muted-foreground">Ticket</dt>
                  <dd className="text-right tabular-nums">${fmtMoney(edition.ticket_price)}</dd>
                  <dt className="text-muted-foreground">Jugadas</dt>
                  <dd className="text-right tabular-nums">
                    {edition.bets_count ?? 0} (${fmtMoney(edition.collected_amount ?? 0)})
                  </dd>
                </dl>
              </li>
            ))}
          </ul>

          <div className="hidden rounded-md border md:block">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Quiniela / Turno</TableHead>
                  <TableHead>Semana</TableHead>
                  <TableHead>Cierre</TableHead>
                  <TableHead className="text-right">Pozo</TableHead>
                  <TableHead className="text-right">Ticket</TableHead>
                  <TableHead className="text-right">Jugadas</TableHead>
                  <TableHead>Estado</TableHead>
                  <TableHead />
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((edition) => (
                  <TableRow key={edition.polla_edition_id}>
                    <TableCell>{editionTitle(edition)}</TableCell>
                    <TableCell>
                      {fmtDate(edition.start_date)} al {fmtDate(edition.end_date)}
                    </TableCell>
                    <TableCell className="whitespace-nowrap">
                      {fmtDate(edition.load_limit_date)} {fmtTime(edition.load_limit_time)}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      <PoolAmount edition={edition} />
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      ${fmtMoney(edition.ticket_price)}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {edition.bets_count ?? 0} (${fmtMoney(edition.collected_amount ?? 0)})
                    </TableCell>
                    <TableCell>{renderStatus(edition)}</TableCell>
                    <TableCell className="text-right">{renderActions(edition)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </InfiniteList>
      )}

      {dialog && (
        <EditionDialog
          edition={dialog.edition}
          extending={dialog.extending}
          lotteries={lotteries?.data ?? []}
          schedules={schedules?.data ?? []}
          organizationId={organizationId}
          onClose={() => setDialog(null)}
        />
      )}
    </div>
  );
};

export default EditionsPage;
