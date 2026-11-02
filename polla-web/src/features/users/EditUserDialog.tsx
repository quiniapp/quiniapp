import { FormEvent, useState } from 'react';
import { toast } from 'react-hot-toast';
import { updatePollaUserSchema } from '@helper/polla/schemas/user.schema';
import {
  IPollaUserEntityFront,
  POLLA_USER_TYPE,
  POLLA_USER_TYPE_LABEL,
  canBePollaStreetUser,
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
import { Switch } from '@/components/ui/switch';
import { groupLabel } from '@/lib/pollaGroups';

interface EditUserDialogProps {
  user: IPollaUserEntityFront;
  groups: IPollaGroupEntityFront[];
  /** La comisión del pasador la fija un superior, no él mismo. */
  canEditFee: boolean;
  onClose: () => void;
}

/**
 * Datos del usuario. La contraseña se cambia aparte, con el blanqueo; solo se
 * pone acá al pasar a aplicación a un usuario de calle (que no tenía). El
 * grupo del pasador queda fijo desde el alta (el jugador toma el de su
 * pasador).
 */
export const EditUserDialog = ({ user, groups, canEditFee, onClose }: EditUserDialogProps) => {
  const isCashier = user.user_type === POLLA_USER_TYPE.CASHIER;
  const hasNumber = isCashier || user.user_type === POLLA_USER_TYPE.PLAYER;
  const canBeStreet = canBePollaStreetUser(user.user_type);

  const [form, setForm] = useState({
    name: user.name,
    last_name: user.last_name ?? '',
    username: user.username ?? '',
    password: '',
    number: user.number ? String(user.number) : '',
    fee: user.fee !== null ? String(user.fee) : '',
    disabled: user.disabled,
    is_street: user.is_street,
  });

  // De calle a aplicación: necesita usuario y contraseña para entrar.
  const toApp = user.is_street && !form.is_street;

  const { mutate: updateUser, isPending } = useUpdateUser();

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();

    const payload: Record<string, unknown> = {
      name: form.name.trim(),
      last_name: form.last_name.trim() || null,
      username: form.is_street ? null : form.username.trim() || null,
      disabled: form.disabled,
      ...(canBeStreet ? { is_street: form.is_street } : {}),
      ...(toApp ? { password: form.password } : {}),
      ...(hasNumber ? { number: form.number ? Number(form.number) : null } : {}),
      ...(isCashier && canEditFee ? { fee: form.fee === '' ? null : Number(form.fee) } : {}),
    };

    if (hasNumber && !payload.number) {
      toast.error('Pasadores y jugadores necesitan un número');
      return;
    }

    if (toApp && (!payload.username || !form.password)) {
      toast.error('Para que entre a la aplicación poné usuario y contraseña');
      return;
    }

    const parsed = updatePollaUserSchema.safeParse(payload);
    if (!parsed.success) {
      toast.error(parsed.error.errors[0]?.message ?? 'Revisá los datos');
      return;
    }

    if (
      form.is_street &&
      !user.is_street &&
      !window.confirm(
        `${user.name} pasa a ser de calle: se borran su usuario y su contraseña y no va a poder entrar. ¿Seguir?`
      )
    ) {
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
            {user.is_street
              ? 'Es de calle: no entra a la aplicación.'
              : 'Para cambiar la contraseña usá Blanquear contraseña.'}
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
            {!form.is_street && (
              <div className="flex flex-col gap-1">
                <Label htmlFor="edit-user-username">Usuario</Label>
                <Input
                  id="edit-user-username"
                  autoComplete="off"
                  value={form.username}
                  onChange={(e) => setForm({ ...form, username: e.target.value })}
                />
              </div>
            )}
            {toApp && (
              <div className="flex flex-col gap-1">
                <Label htmlFor="edit-user-password">Contraseña</Label>
                <Input
                  id="edit-user-password"
                  type="password"
                  autoComplete="new-password"
                  value={form.password}
                  onChange={(e) => setForm({ ...form, password: e.target.value })}
                />
              </div>
            )}
            {hasNumber && (
              <div className="flex flex-col gap-1">
                <Label htmlFor="edit-user-number">
                  {isCashier ? 'Número en el grupo' : 'Número en el pasador'}
                </Label>
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
                <Label htmlFor="edit-user-group">Grupo (no se cambia)</Label>
                <Input
                  id="edit-user-group"
                  readOnly
                  disabled
                  value={groupLabel(
                    groups.find((group) => group.polla_group_id === user.polla_group_id)
                  )}
                />
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

          {canBeStreet && (
            <div className="flex items-center gap-2">
              <Switch
                id="edit-user-street"
                checked={form.is_street}
                onCheckedChange={(checked) => setForm({ ...form, is_street: checked })}
              />
              <Label htmlFor="edit-user-street">
                De calle (sin usuario ni contraseña, no entra)
              </Label>
            </div>
          )}

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
