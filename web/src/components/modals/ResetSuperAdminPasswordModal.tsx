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
import { IOrganizationEntityFront } from '@helper/types/organization.type';
import { toast } from 'react-hot-toast';
import { apiClient } from '@/lib/apiClient';
import { BACKEND_ROUTES } from '../../../routes/routes';
import { IUserEntityFront } from '@helper/types/user.type';

interface ResetSuperAdminPasswordModalProps {
  isOpen: boolean;
  onClose: VoidFunction;
  organization?: IOrganizationEntityFront | null;
  onConfirm: (userId: string, newPassword: string) => Promise<void>;
  isPending?: boolean;
}

const ResetSuperAdminPasswordModal = ({
  isOpen,
  onClose,
  organization,
  onConfirm,
  isPending = false,
}: ResetSuperAdminPasswordModalProps) => {
  const [username, setUsername] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isSearching, setIsSearching] = useState(false);

  const handleClose = () => {
    setUsername('');
    setNewPassword('');
    setConfirmPassword('');
    onClose();
  };

  const handleConfirm = async () => {
    if (!username.trim()) {
      toast.error('El username no puede estar vacío');
      return;
    }

    if (!newPassword.trim()) {
      toast.error('La contraseña no puede estar vacía');
      return;
    }

    if (newPassword !== confirmPassword) {
      toast.error('Las contraseñas no coinciden');
      return;
    }

    if (!organization?.organization_id) {
      toast.error('Organización no válida');
      return;
    }

    try {
      setIsSearching(true);
      // Obtener usuarios para encontrar el SUPERADMIN por username
      const users = await apiClient.get<IUserEntityFront[]>(BACKEND_ROUTES.user.base);
      const superAdmin = users.find(
        (u) => u.username === username && u.organization_id === organization.organization_id
      );

      if (!superAdmin) {
        toast.error(`No se encontró un usuario con username "${username}" en esta organización`);
        return;
      }

      if (!superAdmin.user_id) {
        toast.error('Usuario encontrado pero sin ID válido');
        return;
      }

      await onConfirm(superAdmin.user_id, newPassword);
      handleClose();
    } catch (error: any) {
      // Error ya manejado por el mutation hook
      console.error('Error al resetear contraseña:', error);
    } finally {
      setIsSearching(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Resetear Contraseña del Capitalista</DialogTitle>
          <DialogDescription>
            Ingresa el username del Capitalista de <strong>{organization?.name}</strong> y su nueva
            contraseña
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 py-4">
          <div className="grid gap-2">
            <Label htmlFor="username">Username del Capitalista</Label>
            <Input
              id="username"
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="Ej: superadmin"
              disabled={isPending || isSearching}
            />
          </div>

          <div className="grid gap-2">
            <Label htmlFor="new-password">Nueva Contraseña</Label>
            <Input
              id="new-password"
              type="password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              placeholder="Ingresa la nueva contraseña"
              disabled={isPending || isSearching}
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
              disabled={isPending || isSearching}
            />
          </div>
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={handleClose}
            disabled={isPending || isSearching}
          >
            Cancelar
          </Button>
          <Button
            onClick={handleConfirm}
            disabled={
              !username.trim() ||
              !newPassword.trim() ||
              newPassword !== confirmPassword ||
              isPending ||
              isSearching
            }
          >
            {isSearching
              ? 'Buscando usuario...'
              : isPending
                ? 'Reseteando...'
                : 'Resetear Contraseña'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default ResetSuperAdminPasswordModal;
