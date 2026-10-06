import { FormEvent, useState } from 'react';
import { toast } from 'react-hot-toast';
import { updatePollaUserSchema } from '@helper/polla/schemas/user.schema';
import {
  IPollaUserEntityFront,
  POLLA_USER_TYPE,
  POLLA_USER_TYPE_LABEL,
} from '@helper/polla/types/user.type';
import { IPollaGroupEntityFront } from '@helper/polla/types/catalog.type';
import { useUpdateUser } from '@/hooks/mutations/usePollaMutations';
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
import { Switch } from '@/components/ui/switch';

interface EditUserDialogProps {
  user: IPollaUserEntityFront;
  groups: IPollaGroupEntityFront[];
  /** La comisión del pasador la fija un superior, no él mismo. */
  canEditFee: boolean;
  onClose: () => void;
}

/** Datos del usuario. La contraseña se cambia aparte, con el blanqueo. */
export const EditUserDialog = ({ user, groups, canEditFee, onClose }: EditUserDialogProps) => {
  const isCashier = user.user_type === POLLA_USER_TYPE.CASHIER;
  const hasNumber = isCashier || user.user_type === POLLA_USER_TYPE.PLAYER;

  const [form, setForm] = useState({
    name: user.name,
    last_name: user.last_name ?? '',
    username: user.username ?? '',
    number: user.number ? String(user.number) : '',
    polla_group_id: user.polla_group_id ?? '',
    fee: user.fee !== null ? String(user.fee) : '',
    disabled: user.disabled,
  });

  const { mutate: updateUser, isPending } = useUpdateUser();

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();

    const payload: Record<string, unknown> = {
      name: form.name.trim(),
      last_name: form.last_name.trim() || null,
      username: form.username.trim() || null,
      disabled: form.disabled,
      ...(hasNumber ? { number: form.number ? Number(form.number) : null } : {}),
      ...(isCashier ? { polla_group_id: form.polla_group_id || null } : {}),
      ...(isCashier && canEditFee ? { fee: form.fee === '' ? null : Number(form.fee) } : {}),
    };

    if (hasNumber && !payload.number) {
      toast.error('Pasadores y jugadores necesitan un número');
      return;
    }

    const parsed = updatePollaUserSchema.safeParse(payload);
    if (!parsed.success) {
      toast.error(parsed.error.errors[0]?.message ?? 'Revisá los datos');
      return;
    }

    updateUser({ id: user.polla_user_id, ...payload }, { onSuccess: onClose });
  };

  return (
    <Dialog open onOpenChange={(next) => !next && onClose()}>
      <DialogContent className="max-w-[95vw] sm:max-w-[560px]">
        <DialogHeader>
          <DialogTitle>Editar {POLLA_USER_TYPE_LABEL[user.user_type].toLowerCase()}</DialogTitle>
          <DialogDescription>
            Para cambiar la contraseña usá Blanquear contraseña.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="flex flex-col gap-1">
              <Label htmlFor="edit-user-name">Nombre</Label>
              <Input
                id="edit-user-name"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
              />
            </div>
            <div className="flex flex-col gap-1">
              <Label htmlFor="edit-user-last-name">Apellido</Label>
              <Input
                id="edit-user-last-name"
                value={form.last_name}
                onChange={(e) => setForm({ ...form, last_name: e.target.value })}
              />
            </div>
            <div className="flex flex-col gap-1">
              <Label htmlFor="edit-user-username">Usuario</Label>
              <Input
                id="edit-user-username"
                autoComplete="off"
                value={form.username}
                onChange={(e) => setForm({ ...form, username: e.target.value })}
              />
            </div>
            {hasNumber && (
              <div className="flex flex-col gap-1">
                <Label htmlFor="edit-user-number">Número</Label>
                <Input
                  id="edit-user-number"
                  inputMode="numeric"
                  value={form.number}
                  onChange={(e) => setForm({ ...form, number: e.target.value.replace(/\D/g, '') })}
                />
              </div>
            )}
            {isCashier && (
              <div className="flex flex-col gap-1">
                <Label>Grupo</Label>
                <Select
                  value={form.polla_group_id || 'none'}
                  onValueChange={(v) => setForm({ ...form, polla_group_id: v === 'none' ? '' : v })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Sin grupo" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Sin grupo</SelectItem>
                    {groups.map((group) => (
                      <SelectItem key={group.polla_group_id} value={group.polla_group_id}>
                        {group.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
            {isCashier && canEditFee && (
              <div className="flex flex-col gap-1">
                <Label htmlFor="edit-user-fee">Comisión %</Label>
                <Input
                  id="edit-user-fee"
                  inputMode="decimal"
                  value={form.fee}
                  onChange={(e) => setForm({ ...form, fee: e.target.value })}
                />
              </div>
            )}
          </div>

          <div className="flex items-center gap-2">
            <Switch
              id="edit-user-disabled"
              checked={form.disabled}
              onCheckedChange={(checked) => setForm({ ...form, disabled: checked })}
            />
            <Label htmlFor="edit-user-disabled">Deshabilitado (no puede entrar ni jugar)</Label>
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
