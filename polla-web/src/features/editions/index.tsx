import { useMemo, useState } from 'react';
import dayjs from 'dayjs';
import { toast } from 'react-hot-toast';
import { CalendarPlus, Pencil, Trash2 } from 'lucide-react';
import { newPollaEditionSchema, updatePollaEditionSchema } from '@helper/polla/schemas/game.schema';
import {
  IPollaEditionDraw,
  IPollaEditionEntityFront,
  POLLA_EDITION_PERIOD,
  POLLA_EDITION_PERIOD_LABEL,
  POLLA_EDITION_STATUS,
  POLLA_NUMBERS_REQUIRED,
  POLLA_SPECIAL_MIN_HITS_DEFAULT,
  isPollaSpecialEdition,
  pollaEditionDraws,
  pollaEditionPeriod,
  pollaEditionTitle,
  pollaPrizeRuleLabel,
} from '@helper/polla/types/game.type';
import {
  IPollaLotteryEntityFront,
  IPollaScheduleEntityFront,
} from '@helper/polla/types/catalog.type';
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
import { Switch } from '@/components/ui/switch';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
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

/** Clave de un sorteo en el formulario: `quiniela/turno`. */
const drawKey = (draw: IPollaEditionDraw) => `${draw.polla_lottery_id}/${draw.polla_schedule_id}`;
const drawOfKey = (key: string): IPollaEditionDraw => {
  const [polla_lottery_id, polla_schedule_id] = key.split('/');
  return { polla_lottery_id, polla_schedule_id };
};

interface EditionForm {
  /** Sorteos elegidos (`drawKey`). */
  draws: string[];
  /** Especial: si nadie completa 10, premia desde `min_winning_hits`. */
  special: boolean;
  min_winning_hits: string;
  name: string;
  start_date: string;
  end_date: string;
  load_limit_date: string;
  /** Pasada esta hora del día de cierre, pasadores y jugadores ya no cargan. */
  load_limit_time: string;
  pool_amount: string;
  surprise_pool_amount: string;
  ticket_price: string;
}

const emptyForm: EditionForm = {
  draws: [],
  special: false,
  min_winning_hits: String(POLLA_SPECIAL_MIN_HITS_DEFAULT),
  name: '',
  start_date: '',
  end_date: '',
  load_limit_date: '',
  load_limit_time: '21:00',
  pool_amount: '',
  surprise_pool_amount: '',
  ticket_price: '',
};

const formOf = (edition: IPollaEditionEntityFront): EditionForm => ({
  draws: pollaEditionDraws(edition).map(drawKey),
  special: edition.min_winning_hits < POLLA_NUMBERS_REQUIRED,
  min_winning_hits: String(
    edition.min_winning_hits < POLLA_NUMBERS_REQUIRED
      ? edition.min_winning_hits
      : POLLA_SPECIAL_MIN_HITS_DEFAULT
  ),
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

/**
 * Grilla quiniela × turno: cada casilla es un sorteo de la edición. La regular
 * marca uno; la especial, los que quiera (por ejemplo, las 5 de las 21 h). Se
 * muestran las quinielas y los turnos activos, más los que ya tiene la edición.
 */
const DrawsGrid = ({
  lotteries,
  schedules,
  value,
  onChange,
  disabled,
}: {
  lotteries: IPollaLotteryEntityFront[];
  schedules: IPollaScheduleEntityFront[];
  value: string[];
  onChange: (draws: string[]) => void;
  disabled?: boolean;
}) => {
  const selected = new Set(value);
  const usedLotteries = new Set(value.map((key) => drawOfKey(key).polla_lottery_id));
  const usedSchedules = new Set(value.map((key) => drawOfKey(key).polla_schedule_id));
  const rows = lotteries
    .filter((l) => l.active || usedLotteries.has(l.polla_lottery_id))
    .sort((a, b) => a.order - b.order || a.name.localeCompare(b.name));
  const columns = schedules
    .filter((s) => s.active || usedSchedules.has(s.polla_schedule_id))
    .sort((a, b) => a.time.localeCompare(b.time));

  const toggle = (key: string, checked: boolean) =>
    onChange(checked ? [...value, key] : value.filter((item) => item !== key));

  return (
    <div className="overflow-x-auto rounded-md border">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b">
            <th className="px-2 py-1.5 text-left font-medium">Quiniela</th>
            {columns.map((s) => (
              <th key={s.polla_schedule_id} className="px-2 py-1.5 text-center font-medium">
                <span className="block leading-tight">{s.name}</span>
                <span className="block text-xs font-normal text-muted-foreground">
                  {fmtTime(s.time)}
                </span>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((l) => (
            <tr key={l.polla_lottery_id} className="border-b last:border-0">
              <td className="px-2 py-1">{l.name}</td>
              {columns.map((s) => {
                const key = drawKey({
                  polla_lottery_id: l.polla_lottery_id,
                  polla_schedule_id: s.polla_schedule_id,
                });
                return (
                  <td key={key} className="px-2 py-1 text-center">
                    <Checkbox
                      aria-label={`${l.name} · ${s.name}`}
                      checked={selected.has(key)}
                      onCheckedChange={(checked) => toggle(key, checked === true)}
                      disabled={disabled}
                      className="h-5 w-5"
                    />
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

interface EditionDialogProps {
  /** `null` = edición nueva. */
  edition: IPollaEditionEntityFront | null;
  /** Abre para extender una edición que terminó sin ganador. */
  extending?: boolean;
  lotteries: IPollaLotteryEntityFront[];
  schedules: IPollaScheduleEntityFront[];
  organizationId: string | null;
  onClose: () => void;
}

/**
 * Alta y edición de una edición (superadmin+): sorteos, mínimo de aciertos
 * (especial), precio (vale para las jugadas nuevas, cada una guarda el suyo),
 * fechas, horas, pozo y pozo sorpresa. Extender el fin de una edición que
 * terminó sin ganador la vuelve a poner en juego (la carga no se reabre). Con
 * ganador solo se renombra; con sorteos cargados no se cambian los sorteos, el
 * mínimo ni el inicio (lo controla la base y avisa).
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
    const { special, draws, min_winning_hits, ...rest } = form;
    const values = {
      ...rest,
      draws: draws.map(drawOfKey),
      // La regular es "mínimo 10": sin escalera.
      min_winning_hits: special ? Number(min_winning_hits) : POLLA_NUMBERS_REQUIRED,
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
          <div className="flex flex-col gap-1 sm:col-span-2">
            <Label>Sorteos (quiniela y turno)</Label>
            <DrawsGrid
              lotteries={lotteries}
              schedules={schedules}
              value={form.draws}
              onChange={(draws) => setForm({ ...form, draws })}
              disabled={hasWinner}
            />
            <p className="text-xs text-muted-foreground">
              {form.draws.length > 1
                ? `${form.draws.length} sorteos: los aciertos de cada día suman todos.`
                : 'La regular juega con un sorteo. Marcá varios para una especial.'}
            </p>
          </div>

          <div className="flex flex-col gap-2 rounded-md border p-3 sm:col-span-2">
            <div className="flex items-center justify-between gap-3">
              <Label htmlFor="edition-special" className="cursor-pointer">
                Edición especial
              </Label>
              <Switch
                id="edition-special"
                checked={form.special}
                onCheckedChange={(special) => setForm({ ...form, special })}
                disabled={hasWinner}
              />
            </div>
            {form.special ? (
              <div className="flex flex-col gap-1">
                <Label htmlFor="edition-min-hits">Mínimo de aciertos</Label>
                <Input
                  id="edition-min-hits"
                  type="number"
                  inputMode="numeric"
                  min={1}
                  max={POLLA_NUMBERS_REQUIRED}
                  className="w-24"
                  value={form.min_winning_hits}
                  onChange={(e) => setForm({ ...form, min_winning_hits: e.target.value })}
                  disabled={hasWinner}
                />
                <p className="text-xs text-muted-foreground">
                  Ganan los que completan 10. Si al final nadie llegó, ganan los de más aciertos (9,
                  si no 8, ...) siempre que tengan al menos {form.min_winning_hits || '…'}. Si nadie
                  llega, queda desierta.
                </p>
              </div>
            ) : (
              <p className="text-xs text-muted-foreground">
                Ganan solo los que completan 10, como en la regular.
              </p>
            )}
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

  const catalogs = useMemo(
    () => ({ lotteries: lotteries?.data, schedules: schedules?.data }),
    [lotteries, schedules]
  );

  /** El orden de la lista queda fijo (el de `ALL_PERIODS`) para no duplicar la query. */
  const togglePeriod = (period: POLLA_EDITION_PERIOD, checked: boolean) =>
    setPeriods((prev) => ALL_PERIODS.filter((p) => (p === period ? checked : prev.includes(p))));

  const today = todayIso();

  const editionTitle = (edition: IPollaEditionEntityFront) => pollaEditionTitle(edition, catalogs);

  /** Título con el badge de la especial y su regla de premio. */
  const renderTitle = (edition: IPollaEditionEntityFront) => (
    <>
      <span className="break-words">{editionTitle(edition)}</span>
      {isPollaSpecialEdition(edition) && (
        <span className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1">
          <Badge variant="secondary">Especial</Badge>
          <span className="text-xs text-muted-foreground">{pollaPrizeRuleLabel(edition)}</span>
        </span>
      )}
    </>
  );

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
        description="Puede haber más de una edición en la misma semana, por ejemplo la regular y la especial del sábado: cada ticket juega en la suya. El pozo lo definís vos y le podés sumar un pozo sorpresa mientras no haya ganador."
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
                  <div className="min-w-0 font-medium">{renderTitle(edition)}</div>
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
                  <TableHead>Sorteos</TableHead>
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
                    <TableCell className="max-w-[320px] whitespace-normal">
                      {renderTitle(edition)}
                    </TableCell>
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
