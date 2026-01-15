import { useState } from 'react';
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
import { Button } from '@/components/ui/button';
import { IUserEntityFront } from '@helper/types/user.type';
import { toast } from 'react-hot-toast';

interface ResetPasswordModalProps {
  isOpen: boolean;
  onClose: VoidFunction;
  user?: IUserEntityFront;
  onConfirm: (userId: string, newPassword: string) => Promise<void>;
  isPending?: boolean;
}

const ResetPasswordModal = ({
  isOpen,
  onClose,
  user,
  onConfirm,
  isPending = false,
}: ResetPasswordModalProps) => {
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  const handleClose = () => {
    setNewPassword('');
    setConfirmPassword('');
    onClose();
  };

  const handleConfirm = async () => {
    if (!newPassword.trim()) {
      toast.error('La contraseña no puede estar vacía');
      return;
    }

    if (newPassword !== confirmPassword) {
      toast.error('Las contraseñas no coinciden');
      return;
    }

    if (!user?.user_id) {
      toast.error('Usuario no válido');
      return;
    }

    try {
      await onConfirm(user.user_id, newPassword);
      handleClose();
    } catch (error) {
      // Error handled by mutation
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Resetear Contraseña</DialogTitle>
          <DialogDescription>
            Ingresa la nueva contraseña para el usuario <strong>{user?.name || user?.username}</strong>
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 py-4">
          <div className="grid gap-2">
            <Label htmlFor="new-password">Nueva Contraseña</Label>
            <Input
              id="new-password"
              type="password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              placeholder="Ingresa la nueva contraseña"
              disabled={isPending}
            />
          </div>

          <div className="grid gap-2">
            <Label htmlFor="confirm-password">Confirmar Contraseña</Label>
            <Input
              id="confirm-password"
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder="Confirma la nueva contraseña"
              disabled={isPending}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={handleClose} disabled={isPending}>
            Cancelar
          </Button>
          <Button
            onClick={handleConfirm}
            disabled={!newPassword.trim() || newPassword !== confirmPassword || isPending}
          >
            {isPending ? 'Reseteando...' : 'Resetear Contraseña'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default ResetPasswordModal;
