import { FormEvent, useState } from 'react';
import { toast } from 'react-hot-toast';
import { Pencil, Plus, Trash2 } from 'lucide-react';
import { IPollaGroupEntityFront } from '@helper/polla/types/catalog.type';
import { useGroups } from '@/hooks/fetchs/useCatalogs';
import {
  useCreateGroup,
  useDeleteGroup,
  useUpdateGroup,
} from '@/hooks/mutations/usePollaMutations';
import { EmptyState, PageHeader } from '@/components/PageHeader';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
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

/** Alta y renombre comparten el mismo diálogo: solo cambia el nombre. */
const GroupDialog = ({
  group,
  onClose,
}: {
  /** `null` = grupo nuevo. */
  group: IPollaGroupEntityFront | null;
  onClose: () => void;
}) => {
  const [name, setName] = useState(group?.name ?? '');
  const { mutate: createGroup, isPending: isCreating } = useCreateGroup();
  const { mutate: updateGroup, isPending: isUpdating } = useUpdateGroup();
  const isPending = isCreating || isUpdating;

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    const trimmed = name.trim();
    if (!trimmed) {
      toast.error('Poné un nombre');
      return;
    }

    if (group) {
      updateGroup({ id: group.polla_group_id, name: trimmed }, { onSuccess: onClose });
    } else {
      createGroup({ name: trimmed }, { onSuccess: onClose });
    }
  };

  return (
    <Dialog open onOpenChange={(next) => !next && onClose()}>
      <DialogContent className="max-w-[95vw] sm:max-w-[420px]">
        <DialogHeader>
          <DialogTitle>{group ? 'Editar grupo' : 'Nuevo grupo'}</DialogTitle>
          <DialogDescription>Los pasadores se asignan a un grupo desde Usuarios.</DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="flex flex-col gap-3">
          <div className="flex flex-col gap-1">
            <Label htmlFor="group-name">Nombre</Label>
            <Input
              id="group-name"
              value={name}
              autoFocus
              onChange={(e) => setName(e.target.value)}
            />
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>
              Cancelar
            </Button>
            <Button type="submit" disabled={isPending}>
              {isPending ? 'Guardando…' : 'Guardar'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};

/**
 * Grupos de pasadores de la organización. Los arman el OWNER y el capitalista,
 * cada uno dentro de su propia organización; separados de Organizaciones.
 */
export const GroupsPage = () => {
  // `undefined` = sin diálogo; `null` = alta; un grupo = renombrarlo.
  const [editing, setEditing] = useState<IPollaGroupEntityFront | null | undefined>(undefined);

  const { data, isFetching } = useGroups();
  const { mutate: deleteGroup } = useDeleteGroup();

  const groups = data?.data ?? [];

  return (
    <div>
      <PageHeader
        description="Agrupan pasadores para filtrar jugadas, ventas y cuenta corriente."
        actions={
          <Button type="button" onClick={() => setEditing(null)}>
            <Plus />
            Nuevo grupo
          </Button>
        }
      />

      {groups.length === 0 ? (
        <EmptyState message={isFetching ? 'Cargando…' : 'Todavía no hay grupos'} />
      ) : (
        <div className="overflow-x-auto rounded-md border bg-card text-card-foreground lg:max-w-2xl">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nombre</TableHead>
                <TableHead className="text-right">Acciones</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {groups.map((group) => (
                <TableRow key={group.polla_group_id}>
                  <TableCell className="font-medium">{group.name}</TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-1">
                      <Button
                        type="button"
                        size="icon"
                        variant="ghost"
                        title="Editar"
                        aria-label={`Editar ${group.name}`}
                        onClick={() => setEditing(group)}
                      >
                        <Pencil />
                      </Button>
                      <Button
                        type="button"
                        size="icon"
                        variant="ghost"
                        title="Eliminar"
                        aria-label={`Eliminar ${group.name}`}
                        onClick={() => {
                          if (window.confirm(`¿Eliminar el grupo ${group.name}?`)) {
                            deleteGroup({ id: group.polla_group_id });
                          }
                        }}
                      >
                        <Trash2 />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      {editing !== undefined && (
        <GroupDialog group={editing} onClose={() => setEditing(undefined)} />
      )}
    </div>
  );
};

export default GroupsPage;
