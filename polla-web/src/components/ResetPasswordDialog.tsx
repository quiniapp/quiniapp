import { FormEvent, useState } from 'react';
import { toast } from 'react-hot-toast';
import { resetPollaPasswordSchema } from '@helper/polla/schemas/user.schema';
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

interface ResetPasswordDialogProps {
  /** A quién se le blanquea (para el título). */
  title: string;
  isPending: boolean;
  onConfirm: (password: string) => void;
  onClose: () => void;
}

/**
 * Contraseña temporal elegida por un superior. El usuario la tiene que cambiar
 * al entrar y se le cierran las sesiones abiertas.
 */
export const ResetPasswordDialog = ({
  title,
  isPending,
  onConfirm,
  onClose,
}: ResetPasswordDialogProps) => {
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();

    const parsed = resetPollaPasswordSchema.safeParse({ password });
    if (!parsed.success) {
      toast.error(parsed.error.errors[0]?.message ?? 'Contraseña inválida');
      return;
    }
    if (password !== confirm) {
      toast.error('Las contraseñas no coinciden');
      return;
    }

    onConfirm(password);
  };

  return (
    <Dialog open onOpenChange={(next) => !next && onClose()}>
      <DialogContent className="max-w-[95vw] sm:max-w-[420px]">
        <DialogHeader>
          <DialogTitle>Blanquear contraseña de {title}</DialogTitle>
          <DialogDescription>
            Es una contraseña temporal: la va a tener que cambiar cuando entre.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="flex flex-col gap-3">
          <div className="flex flex-col gap-1">
            <Label htmlFor="reset-password">Contraseña nueva</Label>
            <Input
              id="reset-password"
              type="password"
              autoComplete="new-password"
              autoFocus
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </div>
          <div className="flex flex-col gap-1">
            <Label htmlFor="reset-password-confirm">Repetir contraseña</Label>
            <Input
              id="reset-password-confirm"
              type="password"
              autoComplete="new-password"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
            />
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>
              Cancelar
            </Button>
            <Button type="submit" disabled={isPending}>
              {isPending ? 'Guardando…' : 'Blanquear'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};
