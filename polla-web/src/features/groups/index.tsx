import { FormEvent, useState } from 'react';
import { toast } from 'react-hot-toast';
import { Pencil, Plus, Trash2, UserPlus } from 'lucide-react';
import {
  assignPollaGroupAdminSchema,
  newPollaGroupWithAdminSchema,
} from '@helper/polla/schemas/user.schema';
import { IPollaGroupWithAdmin } from '@helper/polla/types/catalog.type';
import { useAdminsWithoutGroup, useGroups } from '@/hooks/fetchs/useCatalogs';
import {
  NewGroupAdmin,
  useAssignGroupAdmin,
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

const emptyAdmin = {
  name: '',
  last_name: '',
  username: '',
  password: '',
  email: '',
  phone: '',
};

type AdminForm = typeof emptyAdmin;

const adminPayload = (form: AdminForm): NewGroupAdmin => ({
  name: form.name.trim(),
  last_name: form.last_name.trim() || null,
  username: form.username.trim(),
  password: form.password,
  email: form.email.trim() || null,
  phone: form.phone ? Number(form.phone) : null,
});

/** Datos del admin: los mismos que el capitalista de una organización. */
const AdminFields = ({
  form,
  onChange,
  idPrefix,
}: {
  form: AdminForm;
  onChange: (form: AdminForm) => void;
  idPrefix: string;
}) => {
  const field = (key: keyof AdminForm) => ({
    id: `${idPrefix}-${key}`,
    value: form[key],
    onChange: (e: { target: { value: string } }) => onChange({ ...form, [key]: e.target.value }),
  });

  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
      <div className="flex flex-col gap-1">
        <Label htmlFor={`${idPrefix}-name`}>Nombre</Label>
        <Input {...field('name')} />
      </div>
      <div className="flex flex-col gap-1">
        <Label htmlFor={`${idPrefix}-last_name`}>Apellido</Label>
        <Input {...field('last_name')} />
      </div>
      <div className="flex flex-col gap-1">
        <Label htmlFor={`${idPrefix}-username`}>Usuario</Label>
        <Input {...field('username')} autoComplete="off" />
      </div>
      <div className="flex flex-col gap-1">
        <Label htmlFor={`${idPrefix}-password`}>Contraseña (mínimo 6 caracteres)</Label>
        <Input {...field('password')} type="password" autoComplete="new-password" />
      </div>
      <div className="flex flex-col gap-1">
        <Label htmlFor={`${idPrefix}-email`}>Email</Label>
        <Input {...field('email')} type="email" />
      </div>
      <div className="flex flex-col gap-1">
        <Label htmlFor={`${idPrefix}-phone`}>Teléfono</Label>
        <Input
          {...field('phone')}
          inputMode="tel"
          onChange={(e) => onChange({ ...form, phone: e.target.value.replace(/\D/g, '') })}
        />
      </div>
    </div>
  );
};

/** Alta del grupo junto con su admin, como la organización con su capitalista. */
const CreateGroupDialog = ({ onClose }: { onClose: () => void }) => {
  const [name, setName] = useState('');
  const [admin, setAdmin] = useState(emptyAdmin);
  const { mutate: createGroup, isPending } = useCreateGroup();

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();

    const payload = { group: { name: name.trim() }, admin: adminPayload(admin) };
    const parsed = newPollaGroupWithAdminSchema.safeParse(payload);
    if (!parsed.success) {
      toast.error(parsed.error.errors[0]?.message ?? 'Revisá los datos');
      return;
    }

    createGroup(payload, { onSuccess: onClose });
  };

  return (
    <Dialog open onOpenChange={(next) => !next && onClose()}>
      <DialogContent className="max-h-[90vh] max-w-[95vw] overflow-y-auto sm:max-w-[640px]">
        <DialogHeader>
          <DialogTitle>Nuevo grupo con su admin</DialogTitle>
          <DialogDescription>
            El admin opera solo dentro del grupo: carga jugadas y crea pasadores y jugadores, que
            quedan en el grupo.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <fieldset className="rounded-md border px-4 pb-4 pt-2">
            <legend className="px-2 text-sm font-semibold">Grupo</legend>
            <div className="flex flex-col gap-1">
              <Label htmlFor="new-group-name">Nombre del grupo</Label>
              <Input
                id="new-group-name"
                value={name}
                autoFocus
                onChange={(e) => setName(e.target.value)}
              />
            </div>
          </fieldset>

          <fieldset className="rounded-md border px-4 pb-4 pt-2">
            <legend className="px-2 text-sm font-semibold">Admin</legend>
            <AdminFields form={admin} onChange={setAdmin} idPrefix="new-group-admin" />
          </fieldset>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>
              Cancelar
            </Button>
            <Button type="submit" disabled={isPending}>
              {isPending ? 'Creando…' : 'Crear'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};

const RenameGroupDialog = ({
  group,
  onClose,
}: {
  group: IPollaGroupWithAdmin;
  onClose: () => void;
}) => {
  const [name, setName] = useState(group.name);
  const { mutate: updateGroup, isPending } = useUpdateGroup();

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    const trimmed = name.trim();
    if (!trimmed) {
      toast.error('Poné un nombre');
      return;
    }
    updateGroup({ id: group.polla_group_id, name: trimmed }, { onSuccess: onClose });
  };

  return (
    <Dialog open onOpenChange={(next) => !next && onClose()}>
      <DialogContent className="max-w-[95vw] sm:max-w-[420px]">
        <DialogHeader>
          <DialogTitle>Editar grupo</DialogTitle>
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
 * Grupo del modelo anterior sin admin: se le asigna uno de los admins sin
 * grupo o se le crea uno nuevo.
 */
const AssignAdminDialog = ({
  group,
  onClose,
}: {
  group: IPollaGroupWithAdmin;
  onClose: () => void;
}) => {
  const { data: admins = [] } = useAdminsWithoutGroup();
  const [existing, setExisting] = useState('');
  const [admin, setAdmin] = useState(emptyAdmin);
  const { mutate: assign, isPending } = useAssignGroupAdmin();
  const creating = !existing;

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();

    const payload = creating ? { admin: adminPayload(admin) } : { polla_user_id: existing };
    const parsed = assignPollaGroupAdminSchema.safeParse(payload);
    if (!parsed.success) {
      toast.error(parsed.error.errors[0]?.message ?? 'Revisá los datos');
      return;
    }

    assign({ id: group.polla_group_id, ...payload }, { onSuccess: onClose });
  };

  return (
    <Dialog open onOpenChange={(next) => !next && onClose()}>
      <DialogContent className="max-h-[90vh] max-w-[95vw] overflow-y-auto sm:max-w-[640px]">
        <DialogHeader>
          <DialogTitle>Admin de {group.name}</DialogTitle>
          <DialogDescription>
            Elegí un admin que todavía no tiene grupo o cargá uno nuevo.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          {admins.length > 0 && (
            <div className="flex flex-col gap-1">
              <Label>Admin existente</Label>
              <Select
                value={existing || 'new'}
                onValueChange={(v) => setExisting(v === 'new' ? '' : v)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="new">Cargar uno nuevo</SelectItem>
                  {admins.map((item) => (
                    <SelectItem key={item.polla_user_id} value={item.polla_user_id}>
                      {`${item.name} ${item.last_name ?? ''}`.trim()}
                      {item.username ? ` (${item.username})` : ''}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {creating && <AdminFields form={admin} onChange={setAdmin} idPrefix="assign-admin" />}

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

const adminLabel = (group: IPollaGroupWithAdmin) => {
  if (!group.admin) return null;
  const fullName = `${group.admin.name} ${group.admin.last_name ?? ''}`.trim();
  return group.admin.username ? `${fullName} (${group.admin.username})` : fullName;
};

type DialogState =
  | { kind: 'create' }
  | { kind: 'rename'; group: IPollaGroupWithAdmin }
  | { kind: 'admin'; group: IPollaGroupWithAdmin };

/**
 * Grupos de la organización: cada uno con su admin, que opera solo adentro.
 * Los arman superadmin, capitalista y dueño. Borrar un grupo borra su admin,
 * sus pasadores y sus jugadores, y solo se puede con todo liquidado y sin
 * jugadas en juego.
 */
export const GroupsPage = () => {
  const [dialog, setDialog] = useState<DialogState | null>(null);

  const { data, isFetching } = useGroups();
  const { mutate: deleteGroup } = useDeleteGroup();

  const groups = data?.data ?? [];

  return (
    <div>
      <PageHeader
        description="Cada grupo tiene su admin, que carga jugadas y administra pasadores y jugadores del grupo. Tiene su propia cuenta corriente."
        actions={
          <Button type="button" onClick={() => setDialog({ kind: 'create' })}>
            <Plus />
            Nuevo grupo
          </Button>
        }
      />

      {groups.length === 0 ? (
        <EmptyState message={isFetching ? 'Cargando…' : 'Todavía no hay grupos'} />
      ) : (
        <div className="overflow-x-auto rounded-md border bg-card text-card-foreground lg:max-w-3xl">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-12 text-right">Nº</TableHead>
                <TableHead>Nombre</TableHead>
                <TableHead>Admin</TableHead>
                <TableHead className="text-right">Acciones</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {groups.map((group) => (
                <TableRow key={group.polla_group_id}>
                  <TableCell className="text-right tabular-nums">{group.number}</TableCell>
                  <TableCell className="font-medium">{group.name}</TableCell>
                  <TableCell>
                    {adminLabel(group) ?? (
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => setDialog({ kind: 'admin', group })}
                      >
                        <UserPlus />
                        Asignar admin
                      </Button>
                    )}
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-1">
                      <Button
                        type="button"
                        size="icon"
                        variant="ghost"
                        title="Editar"
                        aria-label={`Editar ${group.name}`}
                        onClick={() => setDialog({ kind: 'rename', group })}
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
                          if (
                            window.confirm(
                              `¿Eliminar el grupo ${group.name}? Se borran también su admin, sus pasadores y sus jugadores.`
                            )
                          ) {
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

      {dialog?.kind === 'create' && <CreateGroupDialog onClose={() => setDialog(null)} />}
      {dialog?.kind === 'rename' && (
        <RenameGroupDialog group={dialog.group} onClose={() => setDialog(null)} />
      )}
      {dialog?.kind === 'admin' && (
        <AssignAdminDialog group={dialog.group} onClose={() => setDialog(null)} />
      )}
    </div>
  );
};

export default GroupsPage;
