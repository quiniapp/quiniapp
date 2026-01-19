import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { IUserEntityFront } from '@helper/types/user.type';
import { LockOpen } from 'lucide-react';

interface UnlockUserModalProps {
  isOpen: boolean;
  onClose: () => void;
  user: IUserEntityFront | undefined;
  onConfirm: (userId: string) => Promise<void>;
  isPending: boolean;
}

const UnlockUserModal = ({
  isOpen,
  onClose,
  user,
  onConfirm,
  isPending,
}: UnlockUserModalProps) => {
  const handleConfirm = async () => {
    if (!user?.user_id) return;
    await onConfirm(user.user_id);
    onClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <LockOpen className="h-5 w-5" />
            Desbloquear Usuario
          </DialogTitle>
          <DialogDescription>
            ¿Estás seguro que deseas desbloquear la cuenta de{' '}
            <span className="font-semibold">{user?.name}</span>?
          </DialogDescription>
        </DialogHeader>
        <div className="py-4">
          <p className="text-sm text-muted-foreground">
            Esta acción restablecerá los intentos de inicio de sesión fallidos y permitirá
            que el usuario vuelva a acceder al sistema.
          </p>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={isPending}>
            Cancelar
          </Button>
          <Button onClick={handleConfirm} disabled={isPending}>
            {isPending ? 'Desbloqueando...' : 'Desbloquear'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default UnlockUserModal;
