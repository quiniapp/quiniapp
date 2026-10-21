import { useMemo, useState } from 'react';
import dayjs from 'dayjs';
import { toast } from 'react-hot-toast';
import { Trash2 } from 'lucide-react';
import { newPollaEditionSchema } from '@helper/polla/schemas/game.schema';
import {
  IPollaEditionEntityFront,
  POLLA_EDITION_PERIOD,
  POLLA_EDITION_PERIOD_LABEL,
  pollaEditionPeriod,
} from '@helper/polla/types/game.type';
import { useAuth } from '@/providers/AuthContext';
import { useEditionList } from '@/hooks/fetchs/usePollaData';
import { useLotteries, useSchedules } from '@/hooks/fetchs/useCatalogs';
import { useCreateEdition, useDeleteEdition } from '@/hooks/mutations/usePollaMutations';
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
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
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
  ticket_price: '',
};

const ALL_PERIODS = Object.values(POLLA_EDITION_PERIOD);
const DEFAULT_PERIODS = [POLLA_EDITION_PERIOD.UPCOMING, POLLA_EDITION_PERIOD.PLAYING];

export const EditionsPage = () => {
  const { organizationId } = useAuth();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(emptyForm);
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

  const { mutate: createEdition, isPending } = useCreateEdition();
  const { mutate: deleteEdition } = useDeleteEdition();

  const lotteryById = useMemo(
    () => new Map(lotteries?.data.map((l) => [l.polla_lottery_id, l.name])),
    [lotteries]
  );
  const scheduleById = useMemo(
    () => new Map(schedules?.data.map((s) => [s.polla_schedule_id, s.name])),
    [schedules]
  );

  const handleCreate = () => {
    const parsed = newPollaEditionSchema.safeParse({
      ...form,
      name: form.name || null,
      pool_amount: Number(form.pool_amount),
      ticket_price: Number(form.ticket_price),
      ...(organizationId ? { polla_organization_id: organizationId } : {}),
    });

    if (!parsed.success) {
      toast.error(parsed.error.errors[0]?.message ?? 'Revisá los datos');
      return;
    }

    createEdition(parsed.data, {
      onSuccess: () => {
        setForm(emptyForm);
        setOpen(false);
      },
    });
  };

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

  const renderDelete = (edition: IPollaEditionEntityFront) => (
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
  );

  return (
    <div>
      <PageHeader
        description="Una edición por quiniela, turno y semana. El pozo lo definís vos."
        actions={
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button type="button">Nueva edición</Button>
            </DialogTrigger>
            <DialogContent className="max-w-[95vw] sm:max-w-[560px]">
              <DialogHeader>
                <DialogTitle>Nueva edición</DialogTitle>
              </DialogHeader>

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div className="flex flex-col gap-1">
                  <Label>Quiniela</Label>
                  <Select
                    value={form.polla_lottery_id}
                    onValueChange={(v) => setForm({ ...form, polla_lottery_id: v })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Elegí" />
                    </SelectTrigger>
                    <SelectContent>
                      {lotteries?.data.map((l) => (
                        <SelectItem key={l.polla_lottery_id} value={l.polla_lottery_id}>
                          {l.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="flex flex-col gap-1">
                  <Label>Turno</Label>
                  <Select
                    value={form.polla_schedule_id}
                    onValueChange={(v) => setForm({ ...form, polla_schedule_id: v })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Elegí" />
                    </SelectTrigger>
                    <SelectContent>
                      {schedules?.data.map((s) => (
                        <SelectItem key={s.polla_schedule_id} value={s.polla_schedule_id}>
                          {s.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="flex flex-col gap-1 sm:col-span-2">
                  <Label>Nombre (opcional)</Label>
                  <Input
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
                  />
                </div>
                <div className="flex flex-col gap-1">
                  <Label htmlFor="edition-load-limit-time">Cierre de carga (hora)</Label>
                  <Input
                    id="edition-load-limit-time"
                    type="time"
                    value={form.load_limit_time}
                    onChange={(e) => setForm({ ...form, load_limit_time: e.target.value })}
                  />
                </div>
                <div className="flex flex-col gap-1">
                  <Label htmlFor="edition-start-date">Inicio</Label>
                  <DateInput
                    id="edition-start-date"
                    value={form.start_date}
                    onValueChange={(value) => setForm({ ...form, start_date: value })}
                  />
                </div>
                <div className="flex flex-col gap-1">
                  <Label htmlFor="edition-end-date">Fin</Label>
                  <DateInput
                    id="edition-end-date"
                    value={form.end_date}
                    onValueChange={(value) => setForm({ ...form, end_date: value })}
                  />
                </div>

                <div className="flex flex-col gap-1">
                  <Label>Pozo</Label>
                  <Input
                    inputMode="decimal"
                    value={form.pool_amount}
                    onChange={(e) => setForm({ ...form, pool_amount: e.target.value })}
                  />
                </div>
                <div className="flex flex-col gap-1">
                  <Label>Valor del ticket</Label>
                  <Input
                    inputMode="decimal"
                    value={form.ticket_price}
                    onChange={(e) => setForm({ ...form, ticket_price: e.target.value })}
                  />
                </div>
              </div>

              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setOpen(false)}>
                  Cancelar
                </Button>
                <Button type="button" onClick={handleCreate} disabled={isPending}>
                  {isPending ? 'Creando…' : 'Crear'}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
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
                  <div className="-mr-2 -mt-2 shrink-0">{renderDelete(edition)}</div>
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
                  <dd className="text-right tabular-nums">${fmtMoney(edition.pool_amount)}</dd>
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
                      ${fmtMoney(edition.pool_amount)}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      ${fmtMoney(edition.ticket_price)}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {edition.bets_count ?? 0} (${fmtMoney(edition.collected_amount ?? 0)})
                    </TableCell>
                    <TableCell>{renderStatus(edition)}</TableCell>
                    <TableCell className="text-right">{renderDelete(edition)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </InfiniteList>
      )}
    </div>
  );
};

export default EditionsPage;
