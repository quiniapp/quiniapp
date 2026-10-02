import { useMemo, useState } from 'react';
import dayjs from 'dayjs';
import { toast } from 'react-hot-toast';
import { Trash2 } from 'lucide-react';
import { newPollaEditionSchema } from '@helper/polla/schemas/game.schema';
import { POLLA_EDITION_STATUS } from '@helper/polla/types/game.type';
import { useAuth } from '@/providers/AuthContext';
import { useEditionList } from '@/hooks/fetchs/usePollaData';
import { useLotteries, useSchedules } from '@/hooks/fetchs/useCatalogs';
import { useCreateEdition, useDeleteEdition } from '@/hooks/mutations/usePollaMutations';
import { EmptyState, PageHeader } from '@/components/PageHeader';
import { InfiniteList } from '@/components/InfiniteList';
import { flattenPages } from '@/hooks/useApi';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
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
const fmtMoney = (value: number) =>
  new Intl.NumberFormat('es-AR', { minimumFractionDigits: 2 }).format(Number(value));

const emptyForm = {
  polla_lottery_id: '',
  polla_schedule_id: '',
  name: '',
  start_date: '',
  end_date: '',
  load_limit_date: '',
  pool_amount: '',
  ticket_price: '',
};

export const EditionsPage = () => {
  const { organizationId } = useAuth();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(emptyForm);

  const { data, fetchNextPage, hasNextPage, isFetchingNextPage } = useEditionList({
    polla_organization_id: organizationId ?? undefined,
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
                  <Label>Cierre de carga</Label>
                  <Input
                    type="date"
                    value={form.load_limit_date}
                    onChange={(e) => setForm({ ...form, load_limit_date: e.target.value })}
                  />
                </div>
                <div className="flex flex-col gap-1">
                  <Label>Inicio</Label>
                  <Input
                    type="date"
                    value={form.start_date}
                    onChange={(e) => setForm({ ...form, start_date: e.target.value })}
                  />
                </div>
                <div className="flex flex-col gap-1">
                  <Label>Fin</Label>
                  <Input
                    type="date"
                    value={form.end_date}
                    onChange={(e) => setForm({ ...form, end_date: e.target.value })}
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

      {rows.length === 0 ? (
        <EmptyState message="Todavía no hay ediciones" />
      ) : (
        <InfiniteList
          totalCount={totalCount}
          loadedCount={rows.length}
          hasNextPage={Boolean(hasNextPage)}
          isFetchingNextPage={isFetchingNextPage}
          fetchNextPage={fetchNextPage}
        >
          <div className="rounded-md border">
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
                    <TableCell>
                      {lotteryById.get(edition.polla_lottery_id) ?? '-'} ·{' '}
                      {scheduleById.get(edition.polla_schedule_id) ?? '-'}
                      {edition.name ? ` · ${edition.name}` : ''}
                    </TableCell>
                    <TableCell>
                      {fmtDate(edition.start_date)} al {fmtDate(edition.end_date)}
                    </TableCell>
                    <TableCell>{fmtDate(edition.load_limit_date)}</TableCell>
                    <TableCell className="text-right tabular-nums">
                      ${fmtMoney(edition.pool_amount)}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      ${fmtMoney(edition.ticket_price)}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {edition.bets_count} (${fmtMoney(edition.collected_amount)})
                    </TableCell>
                    <TableCell>
                      {edition.status === POLLA_EDITION_STATUS.ACTIVE ? (
                        <Badge>Activa</Badge>
                      ) : (
                        <Badge variant="outline">
                          Cerrada{' '}
                          {edition.winner_date
                            ? `· ${fmtDate(edition.winner_date)}`
                            : 'sin ganador'}
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      <Button
                        type="button"
                        size="icon"
                        variant="ghost"
                        title="Eliminar"
                        onClick={() => {
                          if (window.confirm('¿Eliminar la edición?')) {
                            deleteEdition({ id: edition.polla_edition_id });
                          }
                        }}
                      >
                        <Trash2 />
                      </Button>
                    </TableCell>
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
