import { useState } from 'react';
import { toast } from 'react-hot-toast';
import { ArrowDown, ArrowUp, Trash2 } from 'lucide-react';
import { IPollaLotteryEntityFront } from '@helper/polla/types/catalog.type';
import { useAuth } from '@/providers/AuthContext';
import { useLotteries, useSchedules } from '@/hooks/fetchs/useCatalogs';
import {
  useCreateLottery,
  useCreateSchedule,
  useDeleteLottery,
  useDeleteSchedule,
  useReorderLotteries,
} from '@/hooks/mutations/usePollaMutations';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';

interface SimpleRow {
  id: string;
  name: string;
  extra?: string;
}

const CatalogCard = ({
  title,
  rows,
  onCreate,
  onDelete,
  withTime = false,
}: {
  title: string;
  rows: SimpleRow[];
  onCreate: (name: string, time?: string) => void;
  onDelete: (id: string) => void;
  withTime?: boolean;
}) => {
  const [name, setName] = useState('');
  const [time, setTime] = useState('21:00');

  const handleCreate = () => {
    if (!name.trim()) {
      toast.error('Poné un nombre');
      return;
    }
    onCreate(name.trim(), withTime ? time : undefined);
    setName('');
  };

  return (
    <section className="flex flex-col gap-3 rounded-xl bg-card p-4">
      <h2 className="text-lg font-medium text-foreground">{title}</h2>

      <div className="flex flex-wrap items-end gap-2">
        <div className="flex flex-1 flex-col gap-1">
          <Label>Nombre</Label>
          <Input value={name} onChange={(e) => setName(e.target.value)} />
        </div>
        {withTime && (
          <div className="flex flex-col gap-1">
            <Label>Horario</Label>
            <Input type="time" value={time} onChange={(e) => setTime(e.target.value)} />
          </div>
        )}
        <Button type="button" onClick={handleCreate}>
          Agregar
        </Button>
      </div>

      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Nombre</TableHead>
              {withTime && <TableHead>Horario</TableHead>}
              <TableHead />
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((row) => (
              <TableRow key={row.id}>
                <TableCell>{row.name}</TableCell>
                {withTime && <TableCell>{row.extra}</TableCell>}
                <TableCell className="text-right">
                  <Button
                    type="button"
                    size="icon"
                    variant="ghost"
                    title="Eliminar"
                    onClick={() => onDelete(row.id)}
                  >
                    <Trash2 />
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </section>
  );
};

/**
 * Quinielas en el orden de la organización (R28): ese orden y su número
 * ("1 - Nacional") se ven en Cargar jugada, los tickets, los listados, los
 * resultados y los PDF. Subir o bajar una guarda el orden en el momento.
 */
const LotteriesCard = ({
  lotteries,
  organizationId,
}: {
  lotteries: IPollaLotteryEntityFront[];
  organizationId?: string;
}) => {
  const [name, setName] = useState('');
  const { mutate: createLottery } = useCreateLottery();
  const { mutate: deleteLottery } = useDeleteLottery();
  const { mutate: reorder, isPending: isReordering } = useReorderLotteries();
  const orgParam = organizationId ? { polla_organization_id: organizationId } : {};

  const handleCreate = () => {
    if (!name.trim()) {
      toast.error('Poné un nombre');
      return;
    }
    createLottery({ name: name.trim(), ...orgParam });
    setName('');
  };

  const move = (index: number, delta: -1 | 1) => {
    const ids = lotteries.map((lottery) => lottery.polla_lottery_id);
    const target = index + delta;
    if (target < 0 || target >= ids.length) return;
    [ids[index], ids[target]] = [ids[target], ids[index]];
    reorder({ polla_lottery_ids: ids, ...orgParam });
  };

  return (
    <section className="flex flex-col gap-3 rounded-xl bg-card p-4">
      <div>
        <h2 className="text-lg font-medium text-foreground">Quinielas y su orden</h2>
        <p className="text-sm text-muted-foreground">
          En este orden y con este número salen en los tickets, los listados, los resultados y los
          PDF (por ejemplo, &quot;1 - Nacional · Nocturna&quot;). Usá las flechas para cambiarlo.
        </p>
      </div>

      <div className="flex flex-wrap items-end gap-2">
        <div className="flex flex-1 flex-col gap-1">
          <Label htmlFor="new-lottery">Nueva quiniela (queda última)</Label>
          <Input id="new-lottery" value={name} onChange={(e) => setName(e.target.value)} />
        </div>
        <Button type="button" onClick={handleCreate}>
          Agregar
        </Button>
      </div>

      <ol className="flex flex-col divide-y rounded-md border">
        {lotteries.map((lottery, index) => (
          <li key={lottery.polla_lottery_id} className="flex items-center gap-2 px-3 py-2">
            <span
              className="inline-flex size-7 shrink-0 items-center justify-center rounded-full bg-primary text-sm font-semibold text-primary-foreground tabular-nums"
              aria-hidden
            >
              {lottery.position ?? index + 1}
            </span>
            <span className="min-w-0 flex-1 truncate font-medium">{lottery.name}</span>
            <Button
              type="button"
              size="icon"
              variant="outline"
              aria-label={`Subir ${lottery.name}`}
              title="Subir"
              disabled={index === 0 || isReordering}
              onClick={() => move(index, -1)}
            >
              <ArrowUp />
            </Button>
            <Button
              type="button"
              size="icon"
              variant="outline"
              aria-label={`Bajar ${lottery.name}`}
              title="Bajar"
              disabled={index === lotteries.length - 1 || isReordering}
              onClick={() => move(index, 1)}
            >
              <ArrowDown />
            </Button>
            <Button
              type="button"
              size="icon"
              variant="ghost"
              aria-label={`Eliminar ${lottery.name}`}
              title="Eliminar"
              onClick={() => deleteLottery({ id: lottery.polla_lottery_id })}
            >
              <Trash2 />
            </Button>
          </li>
        ))}
        {lotteries.length === 0 && (
          <li className="px-3 py-2 text-sm text-muted-foreground">Todavía no hay quinielas</li>
        )}
      </ol>
    </section>
  );
};

export const CatalogsPage = () => {
  const { organizationId } = useAuth();
  const orgParam = organizationId ?? undefined;

  const { data: lotteries } = useLotteries({ polla_organization_id: orgParam });
  const { data: schedules } = useSchedules({ polla_organization_id: orgParam });

  const { mutate: createSchedule } = useCreateSchedule();
  const { mutate: deleteSchedule } = useDeleteSchedule();

  return (
    <div className="flex flex-col gap-6">
      <LotteriesCard lotteries={lotteries?.data ?? []} organizationId={orgParam} />

      <CatalogCard
        title="Turnos"
        withTime
        rows={(schedules?.data ?? []).map((s) => ({
          id: s.polla_schedule_id,
          name: s.name,
          extra: s.time,
        }))}
        onCreate={(name, time) =>
          createSchedule({ name, time, ...(orgParam ? { polla_organization_id: orgParam } : {}) })
        }
        onDelete={(id) => deleteSchedule({ id })}
      />
    </div>
  );
};

export default CatalogsPage;
