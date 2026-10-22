import { useMemo, useState } from 'react';
import { toast } from 'react-hot-toast';
import { KeyRound, Pencil, Trash2 } from 'lucide-react';
import { newPollaUserSchema } from '@helper/polla/schemas/user.schema';
import {
  POLLA_CREATABLE_TYPES,
  POLLA_USER_TYPE,
  POLLA_USER_TYPE_LABEL,
  IPollaUserEntityFront,
  IPollaUserOption,
  canResetPollaPassword,
  pollaUserListTypes,
} from '@helper/polla/types/user.type';
import { useAuth } from '@/providers/AuthContext';
import { useUsers } from '@/hooks/fetchs/usePollaData';
import { useDebouncedValue } from '@/hooks/useDebouncedValue';
import { useGroups } from '@/hooks/fetchs/useCatalogs';
import {
  useCreateUser,
  useDeleteUser,
  useResetUserPassword,
} from '@/hooks/mutations/usePollaMutations';
import { EmptyState, PageHeader } from '@/components/PageHeader';
import { InfiniteList } from '@/components/InfiniteList';
import { UserSearchPicker } from '@/components/UserSearchPicker';
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
};

/** Pasadores y jugadores se buscan por número para cargarles jugadas. */
const needsNumber = (type: POLLA_USER_TYPE | '') =>
  type === POLLA_USER_TYPE.CASHIER || type === POLLA_USER_TYPE.PLAYER;

export const UsersPage = () => {
  const { user, role, organizationId } = useAuth();
  const [typeFilter, setTypeFilter] = useState('');
  /** Solo dígitos busca el número exacto; si no, nombre, apellido o usuario. */
  const [search, setSearch] = useState('');
  const debouncedSearch = useDebouncedValue(search.trim());
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(emptyForm);
  /** Pasador elegido en el buscador para el jugador nuevo (superiores). */
  const [parentCashier, setParentCashier] = useState<IPollaUserOption | null>(null);
  const [editing, setEditing] = useState<IPollaUserEntityFront | null>(null);
  const [resetting, setResetting] = useState<IPollaUserEntityFront | null>(null);

  const isCashier = role === POLLA_USER_TYPE.CASHIER;
  // El admin opera dentro de su grupo: sus pasadores quedan en él y elige el
  // pasador del jugador entre los del grupo.
  const isGroupAdmin = role === POLLA_USER_TYPE.ADMIN;
  // Un superior que crea un jugador elige a qué pasador pertenece.
  const picksCashier = open && !isCashier && form.user_type === POLLA_USER_TYPE.PLAYER;

  const { data, fetchNextPage, hasNextPage, isFetchingNextPage } = useUsers({
    user_type: typeFilter || undefined,
    search: debouncedSearch || undefined,
    polla_organization_id: organizationId ?? undefined,
    // Se listan también los deshabilitados para poder volver a habilitarlos.
    include_disabled: true,
  });

  const { rows, totalCount } = flattenPages(data?.pages);
  const { data: groups } = useGroups({ polla_organization_id: organizationId ?? undefined });

  const { mutate: createUser, isPending } = useCreateUser();
  const { mutate: deleteUser } = useDeleteUser();
  const { mutate: resetPassword, isPending: isResetting } = useResetUserPassword();

  const groupById = useMemo(
    () => new Map(groups?.data.map((group) => [group.polla_group_id, group.name])),
    [groups]
  );

  /** Tipos que ve este rol (los inferiores, sin el capitalista: está en Organizaciones). */
  const visibleTypes = useMemo(() => (role ? pollaUserListTypes(role) : []), [role]);

  /** Qué da de alta este rol (ver `POLLA_CREATABLE_TYPES`). */
  const creatableTypes = role ? POLLA_CREATABLE_TYPES[role] : [];

  const openCreate = (next: boolean) => {
    if (next) {
      setForm({ ...emptyForm, user_type: creatableTypes[0] ?? '' });
      setParentCashier(null);
    }
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
      // El grupo queda fijo desde el alta: el del admin lo pone el backend.
      polla_group_id: isGroupAdmin ? null : form.polla_group_id || null,
      ...(organizationId ? { polla_organization_id: organizationId } : {}),
    };

    if (form.user_type === POLLA_USER_TYPE.PLAYER && !isCashier) {
      if (!parentCashier) {
        toast.error('Elegí el pasador del jugador');
        return;
      }
      payload.parent_polla_user_id = parentCashier.polla_user_id;
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

  const groupName = (item: IPollaUserEntityFront) =>
    item.polla_group_id ? (groupById.get(item.polla_group_id) ?? null) : null;

  /** Usuario, grupo y comisión de la tarjeta mobile; lo que falta no se muestra. */
  const userDetails = (item: IPollaUserEntityFront) => {
    const group = groupName(item);
    return [
      item.username && `${item.username}`,
      group && `Grupo ${group}`,
      item.fee !== null && `Comisión ${item.fee}%`,
    ]
      .filter(Boolean)
      .join(' · ');
  };

  const renderActions = (item: IPollaUserEntityFront) => (
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
  );

  return (
    <div>
      <PageHeader
        description={
          isCashier
            ? 'Tus jugadores'
            : isGroupAdmin
              ? 'Pasadores y jugadores de tu grupo'
              : 'Usuarios de la organización. Los admins se crean junto con su grupo, en Grupos.'
        }
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <Input
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value.slice(0, 50))}
              placeholder="Buscar: número, nombre o usuario"
              aria-label="Buscar usuarios por número, nombre o usuario"
              className="w-full sm:w-[260px]"
            />
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
                    <UserSearchPicker
                      id="new-user-cashier"
                      label="Pasador"
                      userTypes={[POLLA_USER_TYPE.CASHIER]}
                      value={parentCashier}
                      onChange={setParentCashier}
                      placeholder="Número o nombre del pasador"
                      emptyHint="Elegí el pasador del jugador"
                      scope={{ writable: true }}
                    />
                  )}

                  {form.user_type === POLLA_USER_TYPE.CASHIER && (
                    <>
                      {!isGroupAdmin && (
                        <div className="flex flex-col gap-1">
                          <Label>Grupo (no se cambia después)</Label>
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
                      )}
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
        <EmptyState
          message={
            debouncedSearch ? 'No hay usuarios que coincidan' : 'No hay usuarios para mostrar'
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
          {/* Mobile: tarjetas, sin scroll de costado. */}
          <ul className="flex flex-col gap-2 md:hidden">
            {rows.map((item) => (
              <li
                key={item.polla_user_id}
                className="rounded-md border bg-card p-3 text-card-foreground"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="break-words font-medium">
                      {item.number ? `${item.number} · ` : ''}
                      {item.name} {item.last_name ?? ''}
                    </p>
                    <div className="mt-1 flex flex-wrap items-center gap-1">
                      <Badge variant="secondary">{POLLA_USER_TYPE_LABEL[item.user_type]}</Badge>
                      {item.disabled && <Badge variant="outline">Deshabilitado</Badge>}
                    </div>
                    {userDetails(item) && (
                      <p className="mt-1 break-words text-xs text-muted-foreground">
                        {userDetails(item)}
                      </p>
                    )}
                  </div>
                  <div className="shrink-0">{renderActions(item)}</div>
                </div>
              </li>
            ))}
          </ul>

          <div className="hidden overflow-x-auto rounded-md border bg-card text-card-foreground md:block">
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
                    <TableCell>{groupName(item) ?? '-'}</TableCell>
                    <TableCell className="text-right tabular-nums">
                      {item.fee !== null ? `${item.fee}%` : '-'}
                    </TableCell>
                    <TableCell className="text-right">{renderActions(item)}</TableCell>
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
