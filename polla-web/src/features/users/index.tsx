import { useMemo, useState } from 'react';
import { toast } from 'react-hot-toast';
import { KeyRound, Pencil, Trash2 } from 'lucide-react';
import { newPollaUserSchema } from '@helper/polla/schemas/user.schema';
import {
  POLLA_CREATABLE_TYPES,
  POLLA_USER_TYPE,
  POLLA_USER_HIERARCHY,
  POLLA_USER_TYPE_LABEL,
  IPollaUserEntityFront,
  canResetPollaPassword,
} from '@helper/polla/types/user.type';
import { useAuth } from '@/providers/AuthContext';
import { useUserOptions, useUsers } from '@/hooks/fetchs/usePollaData';
import { useGroups } from '@/hooks/fetchs/useCatalogs';
import {
  useCreateUser,
  useDeleteUser,
  useResetUserPassword,
} from '@/hooks/mutations/usePollaMutations';
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
import { ResetPasswordDialog } from '@/components/ResetPasswordDialog';
import { EditUserDialog } from './EditUserDialog';

const emptyForm = {
  user_type: '' as POLLA_USER_TYPE | '',
  name: '',
  last_name: '',
  username: '',
  password: '',
  number: '',
  fee: '',
  polla_group_id: '',
  /** Pasador del jugador, cuando lo crea un superior (el pasador no lo elige). */
  parent_polla_user_id: '',
};

/** Pasadores y jugadores se buscan por número para cargarles jugadas. */
const needsNumber = (type: POLLA_USER_TYPE | '') =>
  type === POLLA_USER_TYPE.CASHIER || type === POLLA_USER_TYPE.PLAYER;

export const UsersPage = () => {
  const { user, role, organizationId } = useAuth();
  const [typeFilter, setTypeFilter] = useState('');
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [editing, setEditing] = useState<IPollaUserEntityFront | null>(null);
  const [resetting, setResetting] = useState<IPollaUserEntityFront | null>(null);

  const isCashier = role === POLLA_USER_TYPE.CASHIER;
  // Un superior que crea un jugador elige a qué pasador pertenece.
  const picksCashier = open && !isCashier && form.user_type === POLLA_USER_TYPE.PLAYER;

  const { data, fetchNextPage, hasNextPage, isFetchingNextPage } = useUsers({
    user_type: typeFilter || undefined,
    polla_organization_id: organizationId ?? undefined,
    // Se listan también los deshabilitados para poder volver a habilitarlos.
    include_disabled: true,
  });

  const { rows, totalCount } = flattenPages(data?.pages);
  const { data: groups } = useGroups({ polla_organization_id: organizationId ?? undefined });
  const { data: cashiers } = useUserOptions(
    { user_type: POLLA_USER_TYPE.CASHIER, limit: 200 },
    picksCashier
  );

  const { mutate: createUser, isPending } = useCreateUser();
  const { mutate: deleteUser } = useDeleteUser();
  const { mutate: resetPassword, isPending: isResetting } = useResetUserPassword();

  const groupById = useMemo(
    () => new Map(groups?.data.map((group) => [group.polla_group_id, group.name])),
    [groups]
  );

  /** Tipos que ve este rol (los inferiores). */
  const visibleTypes = useMemo(
    () =>
      role
        ? Object.values(POLLA_USER_TYPE).filter(
            (t) => POLLA_USER_HIERARCHY[t] > POLLA_USER_HIERARCHY[role]
          )
        : [],
    [role]
  );

  /** Qué da de alta este rol (ver `POLLA_CREATABLE_TYPES`). */
  const creatableTypes = role ? POLLA_CREATABLE_TYPES[role] : [];

  const openCreate = (next: boolean) => {
    if (next) setForm({ ...emptyForm, user_type: creatableTypes[0] ?? '' });
    setOpen(next);
  };

  const handleCreate = () => {
    if (!form.user_type) {
      toast.error('Elegí el tipo de usuario');
      return;
    }

    const payload: Record<string, unknown> = {
      user_type: form.user_type,
      name: form.name.trim(),
      last_name: form.last_name.trim() || null,
      username: form.username.trim() || null,
      password: form.password,
      number: needsNumber(form.user_type) && form.number ? Number(form.number) : null,
      polla_group_id: form.polla_group_id || null,
      ...(organizationId ? { polla_organization_id: organizationId } : {}),
    };

    if (form.user_type === POLLA_USER_TYPE.PLAYER && !isCashier) {
      if (!form.parent_polla_user_id) {
        toast.error('Elegí el pasador del jugador');
        return;
      }
      payload.parent_polla_user_id = form.parent_polla_user_id;
    }

    if (form.user_type === POLLA_USER_TYPE.CASHIER) {
      payload.fee = form.fee === '' ? null : Number(form.fee);
    }

    // El pasador no manda el padre de su jugador (lo pone el backend con su
    // propio id): se valida como lo va a validar el backend.
    const parsed = newPollaUserSchema.safeParse(
      isCashier ? { ...payload, parent_polla_user_id: user?.polla_user_id } : payload
    );
    if (!parsed.success) {
      toast.error(parsed.error.errors[0]?.message ?? 'Revisá los datos');
      return;
    }

    createUser(payload, {
      onSuccess: () => {
        setForm(emptyForm);
        setOpen(false);
      },
    });
  };

  return (
    <div>
      <PageHeader
        description={isCashier ? 'Tus jugadores' : 'Usuarios de la organización'}
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <Select
              value={typeFilter || 'all'}
              onValueChange={(v) => setTypeFilter(v === 'all' ? '' : v)}
            >
              <SelectTrigger className="w-full sm:w-[200px]">
                <SelectValue placeholder="Todos los tipos" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos los tipos</SelectItem>
                {visibleTypes.map((type) => (
                  <SelectItem key={type} value={type}>
                    {POLLA_USER_TYPE_LABEL[type]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Dialog open={open} onOpenChange={openCreate}>
              <DialogTrigger asChild>
                <Button type="button" disabled={creatableTypes.length === 0}>
                  {isCashier ? 'Nuevo jugador' : 'Nuevo usuario'}
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-[95vw] sm:max-w-[560px]">
                <DialogHeader>
                  <DialogTitle>{isCashier ? 'Nuevo jugador' : 'Nuevo usuario'}</DialogTitle>
                </DialogHeader>

                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  {!isCashier && (
                    <div className="flex flex-col gap-1">
                      <Label>Tipo</Label>
                      <Select
                        value={form.user_type}
                        onValueChange={(v) => setForm({ ...form, user_type: v as POLLA_USER_TYPE })}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Elegí el tipo" />
                        </SelectTrigger>
                        <SelectContent>
                          {creatableTypes.map((type) => (
                            <SelectItem key={type} value={type}>
                              {POLLA_USER_TYPE_LABEL[type]}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  )}

                  <div className="flex flex-col gap-1">
                    <Label htmlFor="new-user-name">Nombre</Label>
                    <Input
                      id="new-user-name"
                      value={form.name}
                      onChange={(e) => setForm({ ...form, name: e.target.value })}
                    />
                  </div>

                  <div className="flex flex-col gap-1">
                    <Label htmlFor="new-user-last-name">Apellido</Label>
                    <Input
                      id="new-user-last-name"
                      value={form.last_name}
                      onChange={(e) => setForm({ ...form, last_name: e.target.value })}
                    />
                  </div>

                  {needsNumber(form.user_type) && (
                    <div className="flex flex-col gap-1">
                      <Label htmlFor="new-user-number">Número</Label>
                      <Input
                        id="new-user-number"
                        inputMode="numeric"
                        value={form.number}
                        onChange={(e) =>
                          setForm({ ...form, number: e.target.value.replace(/\D/g, '') })
                        }
                      />
                    </div>
                  )}

                  <div className="flex flex-col gap-1">
                    <Label htmlFor="new-user-username">Usuario</Label>
                    <Input
                      id="new-user-username"
                      autoComplete="off"
                      value={form.username}
                      onChange={(e) => setForm({ ...form, username: e.target.value })}
                    />
                  </div>

                  <div className="flex flex-col gap-1">
                    <Label htmlFor="new-user-password">Contraseña</Label>
                    <Input
                      id="new-user-password"
                      type="password"
                      autoComplete="new-password"
                      value={form.password}
                      onChange={(e) => setForm({ ...form, password: e.target.value })}
                    />
                  </div>

                  {picksCashier && (
                    <div className="flex flex-col gap-1">
                      <Label>Pasador</Label>
                      <Select
                        value={form.parent_polla_user_id}
                        onValueChange={(v) => setForm({ ...form, parent_polla_user_id: v })}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Elegí el pasador" />
                        </SelectTrigger>
                        <SelectContent>
                          {cashiers?.data.map((cashier) => (
                            <SelectItem key={cashier.polla_user_id} value={cashier.polla_user_id}>
                              {cashier.number ? `${cashier.number} · ` : ''}
                              {cashier.name} {cashier.last_name ?? ''}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  )}

                  {form.user_type === POLLA_USER_TYPE.CASHIER && (
                    <>
                      <div className="flex flex-col gap-1">
                        <Label>Grupo</Label>
                        <Select
                          value={form.polla_group_id || 'none'}
                          onValueChange={(v) =>
                            setForm({ ...form, polla_group_id: v === 'none' ? '' : v })
                          }
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="Sin grupo" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="none">Sin grupo</SelectItem>
                            {groups?.data.map((group) => (
                              <SelectItem key={group.polla_group_id} value={group.polla_group_id}>
                                {group.name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="flex flex-col gap-1">
                        <Label htmlFor="new-user-fee">Comisión %</Label>
                        <Input
                          id="new-user-fee"
                          inputMode="decimal"
                          value={form.fee}
                          onChange={(e) => setForm({ ...form, fee: e.target.value })}
                        />
                      </div>
                    </>
                  )}
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
          </div>
        }
      />

      {rows.length === 0 ? (
        <EmptyState message="No hay usuarios para mostrar" />
      ) : (
        <InfiniteList
          totalCount={totalCount}
          loadedCount={rows.length}
          hasNextPage={Boolean(hasNextPage)}
          isFetchingNextPage={isFetchingNextPage}
          fetchNextPage={fetchNextPage}
        >
          <div className="overflow-x-auto rounded-md border bg-card text-card-foreground">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nombre</TableHead>
                  <TableHead>Tipo</TableHead>
                  <TableHead>Usuario</TableHead>
                  <TableHead>Grupo</TableHead>
                  <TableHead className="text-right">Comisión</TableHead>
                  <TableHead className="text-right">Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((item) => (
                  <TableRow key={item.polla_user_id}>
                    <TableCell>
                      {item.number ? `${item.number} · ` : ''}
                      {item.name} {item.last_name ?? ''}
                      {item.disabled && (
                        <Badge variant="outline" className="ml-2">
                          Deshabilitado
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell>{POLLA_USER_TYPE_LABEL[item.user_type]}</TableCell>
                    <TableCell>{item.username ?? '-'}</TableCell>
                    <TableCell>
                      {item.polla_group_id ? (groupById.get(item.polla_group_id) ?? '-') : '-'}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {item.fee !== null ? `${item.fee}%` : '-'}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-1">
                        <Button
                          type="button"
                          size="icon"
                          variant="ghost"
                          title="Editar"
                          aria-label={`Editar a ${item.name}`}
                          onClick={() => setEditing(item)}
                        >
                          <Pencil />
                        </Button>
                        {/* Cada rol blanquea solo a ciertos tipos y nadie a sí mismo. */}
                        {role &&
                          canResetPollaPassword(role, item.user_type) &&
                          item.polla_user_id !== user?.polla_user_id && (
                            <Button
                              type="button"
                              size="icon"
                              variant="ghost"
                              title="Blanquear contraseña"
                              aria-label={`Blanquear la contraseña de ${item.name}`}
                              onClick={() => setResetting(item)}
                            >
                              <KeyRound />
                            </Button>
                          )}
                        <Button
                          type="button"
                          size="icon"
                          variant="ghost"
                          title="Eliminar"
                          aria-label={`Eliminar a ${item.name}`}
                          onClick={() => {
                            if (window.confirm(`¿Eliminar a ${item.name}?`)) {
                              deleteUser({ id: item.polla_user_id });
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
        </InfiniteList>
      )}

      {editing && (
        <EditUserDialog
          user={editing}
          groups={groups?.data ?? []}
          canEditFee={!isCashier}
          onClose={() => setEditing(null)}
        />
      )}
      {resetting && (
        <ResetPasswordDialog
          title={resetting.name}
          isPending={isResetting}
          onConfirm={(password) =>
            resetPassword(
              { id: resetting.polla_user_id, password },
              { onSuccess: () => setResetting(null) }
            )
          }
          onClose={() => setResetting(null)}
        />
      )}
    </div>
  );
};

export default UsersPage;
