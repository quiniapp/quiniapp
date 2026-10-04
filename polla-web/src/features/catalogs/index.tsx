import { useState } from 'react';
import { toast } from 'react-hot-toast';
import { Trash2 } from 'lucide-react';
import { useAuth } from '@/providers/AuthContext';
import { useGroups, useLotteries, useSchedules } from '@/hooks/fetchs/useCatalogs';
import {
  useCreateGroup,
  useCreateLottery,
  useCreateSchedule,
  useDeleteGroup,
  useDeleteLottery,
  useDeleteSchedule,
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
  // eslint-disable-next-line no-unused-vars
  onCreate: (name: string, time?: string) => void;
  // eslint-disable-next-line no-unused-vars
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

export const CatalogsPage = () => {
  const { organizationId } = useAuth();
  const orgParam = organizationId ?? undefined;

  const { data: lotteries } = useLotteries({ polla_organization_id: orgParam });
  const { data: schedules } = useSchedules({ polla_organization_id: orgParam });
  const { data: groups } = useGroups({ polla_organization_id: orgParam });

  const { mutate: createLottery } = useCreateLottery();
  const { mutate: deleteLottery } = useDeleteLottery();
  const { mutate: createSchedule } = useCreateSchedule();
  const { mutate: deleteSchedule } = useDeleteSchedule();
  const { mutate: createGroup } = useCreateGroup();
  const { mutate: deleteGroup } = useDeleteGroup();

  return (
    <div className="flex flex-col gap-6">
      <CatalogCard
        title="Quinielas"
        rows={(lotteries?.data ?? []).map((l) => ({ id: l.polla_lottery_id, name: l.name }))}
        onCreate={(name) =>
          createLottery({ name, ...(orgParam ? { polla_organization_id: orgParam } : {}) })
        }
        onDelete={(id) => deleteLottery({ id })}
      />

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

      <CatalogCard
        title="Grupos"
        rows={(groups?.data ?? []).map((g) => ({ id: g.polla_group_id, name: g.name }))}
        onCreate={(name) =>
          createGroup({ name, ...(orgParam ? { polla_organization_id: orgParam } : {}) })
        }
        onDelete={(id) => deleteGroup({ id })}
      />
    </div>
  );
};

export default CatalogsPage;
