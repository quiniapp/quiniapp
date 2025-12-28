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
      // Validate SUPERADMIN exists in the specified organization
      // apiClient returns the first value of data object (user_id as string)
      const userId = await apiClient.get<string>(
        BACKEND_ROUTES.user.validateSuperAdmin(username, organization.organization_id)
      );

      await onConfirm(userId, newPassword);
      handleClose();
    } catch (error: any) {
      // Error already handled by apiClient
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
