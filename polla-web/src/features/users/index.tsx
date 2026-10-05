import { useMemo, useState } from 'react';
import dayjs from 'dayjs';
import { toast } from 'react-hot-toast';
import { Trash2, Wallet } from 'lucide-react';
import { newPollaUserSchema } from '@helper/polla/schemas/user.schema';
import {
  POLLA_USER_TYPE,
  POLLA_USER_HIERARCHY,
  IPollaUserEntityFront,
} from '@helper/polla/types/user.type';
import { POLLA_CREDIT_MOVEMENT_TYPE } from '@helper/polla/types/game.type';
import { useAuth } from '@/providers/AuthContext';
import { useCreditMovements, useUserOptions, useUsers } from '@/hooks/fetchs/usePollaData';
import { useGroups } from '@/hooks/fetchs/useCatalogs';
import {
  useAdjustCredits,
  useCreateUser,
  useDeleteUser,
} from '@/hooks/mutations/usePollaMutations';
import { EmptyState, PageHeader } from '@/components/PageHeader';
import { InfiniteList } from '@/components/InfiniteList';
import { flattenPages } from '@/hooks/useApi';
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

const fmtMoney = (value: number) =>
  new Intl.NumberFormat('es-AR', { minimumFractionDigits: 2 }).format(Number(value));

const emptyForm = {
  user_type: POLLA_USER_TYPE.PLAYER as POLLA_USER_TYPE,
  name: '',
  last_name: '',
  username: '',
  password: '',
  number: '',
  fee: '',
  parent_polla_user_id: '',
  polla_group_id: '',
};

const CreditsDialog = ({
  player,
  onClose,
}: {
  player: IPollaUserEntityFront | null;
  onClose: () => void;
}) => {
  const [amount, setAmount] = useState('');
  const [type, setType] = useState<string>(POLLA_CREDIT_MOVEMENT_TYPE.LOAD);
  const [reason, setReason] = useState('');

  const { data: movements } = useCreditMovements(player?.polla_user_id ?? null);
  const { rows: movementsRows } = flattenPages(movements?.pages);
  const { mutate: adjust, isPending } = useAdjustCredits();

  const handleSubmit = () => {
    const value = Number(amount);
    if (!player || !Number.isFinite(value) || value === 0) {
      toast.error('Ingresá un monto');
      return;
    }

    adjust(
      {
        id: player.polla_user_id,
        // Un retiro se manda en negativo: el signo lo valida el backend.
        amount: type === POLLA_CREDIT_MOVEMENT_TYPE.WITHDRAW ? -Math.abs(value) : Math.abs(value),
        type,
        reason: reason || null,
      },
      {
        onSuccess: () => {
          setAmount('');
          setReason('');
        },
      }
    );
  };

  return (
    <Dialog open={Boolean(player)} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-[95vw] sm:max-w-[560px]">
        <DialogHeader>
          <DialogTitle>
            Créditos de {player?.name} · saldo ${fmtMoney(player?.credit_balance ?? 0)}
          </DialogTitle>
        </DialogHeader>

        <div className="flex flex-wrap items-end gap-2">
          <div className="flex flex-col gap-1">
            <Label>Tipo</Label>
            <Select value={type} onValueChange={setType}>
              <SelectTrigger className="w-full sm:w-[160px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={POLLA_CREDIT_MOVEMENT_TYPE.LOAD}>Carga</SelectItem>
                <SelectItem value={POLLA_CREDIT_MOVEMENT_TYPE.WITHDRAW}>Retiro</SelectItem>
                <SelectItem value={POLLA_CREDIT_MOVEMENT_TYPE.ADJUSTMENT}>Ajuste</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="flex flex-col gap-1">
            <Label>Monto</Label>
            <Input
              inputMode="decimal"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              className="w-full sm:w-[140px]"
            />
          </div>
          <div className="flex flex-1 flex-col gap-1">
            <Label>Motivo</Label>
            <Input value={reason} onChange={(e) => setReason(e.target.value)} />
          </div>
          <Button type="button" onClick={handleSubmit} disabled={isPending}>
            Aplicar
          </Button>
        </div>

        <div className="max-h-64 overflow-y-auto rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Fecha</TableHead>
                <TableHead>Tipo</TableHead>
                <TableHead className="text-right">Monto</TableHead>
                <TableHead className="text-right">Saldo</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {movementsRows.map((movement) => (
                <TableRow key={movement.polla_credit_movement_id}>
                  <TableCell>{dayjs(movement.created_at).format('DD-MM HH:mm')}</TableCell>
                  <TableCell>{movement.type}</TableCell>
                  <TableCell className="text-right tabular-nums">
                    ${fmtMoney(movement.amount)}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    ${fmtMoney(movement.balance_after)}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={onClose}>
            Cerrar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export const UsersPage = () => {
  const { role, organizationId } = useAuth();
  const [typeFilter, setTypeFilter] = useState('');
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [creditsFor, setCreditsFor] = useState<IPollaUserEntityFront | null>(null);

  const isCashier = role === POLLA_USER_TYPE.CASHIER;

  const { data, fetchNextPage, hasNextPage, isFetchingNextPage } = useUsers({
    user_type: typeFilter || undefined,
    polla_organization_id: organizationId ?? undefined,
  });

  const { rows, totalCount } = flattenPages(data?.pages);
  const { data: groups } = useGroups({ polla_organization_id: organizationId ?? undefined });
  const { data: cashiers } = useUserOptions({ user_type: POLLA_USER_TYPE.CASHIER }, !isCashier);

  const { mutate: createUser, isPending } = useCreateUser();
  const { mutate: deleteUser } = useDeleteUser();

  const creatableTypes = useMemo(() => {
    if (!role) return [];
    if (isCashier) return [POLLA_USER_TYPE.PLAYER];
    return Object.values(POLLA_USER_TYPE).filter(
      (t) => POLLA_USER_HIERARCHY[t] > POLLA_USER_HIERARCHY[role]
    );
  }, [role, isCashier]);

  const handleCreate = () => {
    const payload: Record<string, unknown> = {
      user_type: form.user_type,
      name: form.name,
      last_name: form.last_name || null,
      username: form.username || null,
      password: form.password,
      number: form.number ? Number(form.number) : null,
      polla_group_id: form.polla_group_id || null,
      ...(organizationId ? { polla_organization_id: organizationId } : {}),
    };

    if (form.user_type === POLLA_USER_TYPE.CASHIER) {
      payload.fee = Number(form.fee || 0);
    }
    if (form.user_type === POLLA_USER_TYPE.PLAYER && !isCashier) {
      payload.parent_polla_user_id = form.parent_polla_user_id || null;
    }

    // Un pasador no manda el padre: lo completa el backend con su propio id,
    // así que ese caso no pasa por el schema acá.
    if (!isCashier) {
      const parsed = newPollaUserSchema.safeParse(payload);
      if (!parsed.success) {
        toast.error(parsed.error.errors[0]?.message ?? 'Revisá los datos');
        return;
      }
    } else if (!form.name || form.password.length < 6) {
      toast.error('Nombre y contraseña (mínimo 6 caracteres) son obligatorios');
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
        description={isCashier ? 'Tus jugadores y sus créditos' : 'Usuarios de la organización'}
        actions={
          <div className="flex items-center gap-2">
            <Select
              value={typeFilter || 'all'}
              onValueChange={(v) => setTypeFilter(v === 'all' ? '' : v)}
            >
              <SelectTrigger className="w-full sm:w-[180px]">
                <SelectValue placeholder="Todos los tipos" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos los tipos</SelectItem>
                {creatableTypes.map((type) => (
                  <SelectItem key={type} value={type}>
                    {type}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Dialog open={open} onOpenChange={setOpen}>
              <DialogTrigger asChild>
                <Button type="button">Nuevo usuario</Button>
              </DialogTrigger>
              <DialogContent className="max-w-[95vw] sm:max-w-[560px]">
                <DialogHeader>
                  <DialogTitle>Nuevo usuario</DialogTitle>
                </DialogHeader>

                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <div className="flex flex-col gap-1">
                    <Label>Tipo</Label>
                    <Select
                      value={form.user_type}
                      onValueChange={(v) => setForm({ ...form, user_type: v as POLLA_USER_TYPE })}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {creatableTypes.map((type) => (
                          <SelectItem key={type} value={type}>
                            {type}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="flex flex-col gap-1">
                    <Label>Nombre</Label>
                    <Input
                      value={form.name}
                      onChange={(e) => setForm({ ...form, name: e.target.value })}
                    />
                  </div>

                  <div className="flex flex-col gap-1">
                    <Label>Usuario</Label>
                    <Input
                      value={form.username}
                      onChange={(e) => setForm({ ...form, username: e.target.value })}
                    />
                  </div>

                  <div className="flex flex-col gap-1">
                    <Label>Contraseña</Label>
                    <Input
                      type="password"
                      value={form.password}
                      onChange={(e) => setForm({ ...form, password: e.target.value })}
                    />
                  </div>

                  {form.user_type === POLLA_USER_TYPE.CASHIER && (
                    <>
                      <div className="flex flex-col gap-1">
                        <Label>Número</Label>
                        <Input
                          inputMode="numeric"
                          value={form.number}
                          onChange={(e) => setForm({ ...form, number: e.target.value })}
                        />
                      </div>
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
                        <Label>Comisión %</Label>
                        <Input
                          inputMode="decimal"
                          value={form.fee}
                          onChange={(e) => setForm({ ...form, fee: e.target.value })}
                        />
                      </div>
                    </>
                  )}

                  {form.user_type === POLLA_USER_TYPE.PLAYER && !isCashier && (
                    <div className="flex flex-col gap-1 sm:col-span-2">
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
                              {cashier.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
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
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nombre</TableHead>
                  <TableHead>Tipo</TableHead>
                  <TableHead>Usuario</TableHead>
                  <TableHead className="text-right">Comisión</TableHead>
                  <TableHead className="text-right">Créditos</TableHead>
                  <TableHead />
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((item) => (
                  <TableRow key={item.polla_user_id}>
                    <TableCell>
                      {item.number ? `${item.number} · ` : ''}
                      {item.name} {item.last_name ?? ''}
                    </TableCell>
                    <TableCell>{item.user_type}</TableCell>
                    <TableCell>{item.username ?? '-'}</TableCell>
                    <TableCell className="text-right tabular-nums">
                      {item.fee !== null ? `${item.fee}%` : '-'}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {item.user_type === POLLA_USER_TYPE.PLAYER
                        ? `$${fmtMoney(item.credit_balance)}`
                        : '-'}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-1">
                        {item.user_type === POLLA_USER_TYPE.PLAYER && (
                          <Button
                            type="button"
                            size="icon"
                            variant="ghost"
                            title="Créditos"
                            onClick={() => setCreditsFor(item)}
                          >
                            <Wallet />
                          </Button>
                        )}
                        <Button
                          type="button"
                          size="icon"
                          variant="ghost"
                          title="Eliminar"
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

      <CreditsDialog player={creditsFor} onClose={() => setCreditsFor(null)} />
    </div>
  );
};

export default UsersPage;
