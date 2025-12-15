import { useState } from 'react';
import Box from '@/components/box';
import HeaderSection from '@/components/header-section';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/contexts/AuthContext';
import { useOrganizations } from '@/hooks/fetchs/organization/useOrganizations';
import { useCreateOrganization } from '@/hooks/mutations/organization/useCreateOrganization';
import { useUpdateOrganization } from '@/hooks/mutations/organization/useUpdateOrganization';
import { useDeleteOrganization } from '@/hooks/mutations/organization/useDeleteOrganization';
import { Plus, Pencil, Trash2 } from 'lucide-react';
import { IOrganizationEntityFront } from '@helper/types/organization.type';
import { USER_TYPE } from '@helper/types/user.type';
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

const OrganizationsContent = () => {
  const { role } = useAuth();
  const { data: organizations, isLoading, error } = useOrganizations(role);
  const createMutation = useCreateOrganization();
  const updateMutation = useUpdateOrganization();
  const deleteMutation = useDeleteOrganization();

  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [selectedOrg, setSelectedOrg] = useState<IOrganizationEntityFront | null>(null);
  const [formName, setFormName] = useState('');

  const handleCreate = () => {
    setFormName('');
    setIsCreateDialogOpen(true);
  };

  const handleEdit = (org: IOrganizationEntityFront) => {
    setSelectedOrg(org);
    setFormName(org.name);
    setIsEditDialogOpen(true);
  };

  const handleDelete = (org: IOrganizationEntityFront) => {
    setSelectedOrg(org);
    setIsDeleteDialogOpen(true);
  };

  const handleSubmitCreate = async () => {
    if (!formName.trim()) return;

    try {
      await createMutation.mutateAsync({ name: formName });
      setIsCreateDialogOpen(false);
      setFormName('');
    } catch (error) {
      console.error('Error creando organización:', error);
    }
  };

  const handleSubmitEdit = async () => {
    if (!formName.trim() || !selectedOrg) return;

    try {
      await updateMutation.mutateAsync({
        organization_id: selectedOrg.organization_id,
        name: formName,
      });
      setIsEditDialogOpen(false);
      setFormName('');
      setSelectedOrg(null);
    } catch (error) {
      console.error('Error actualizando organización:', error);
    }
  };

  const handleConfirmDelete = async () => {
    if (!selectedOrg) return;

    try {
      await deleteMutation.mutateAsync(selectedOrg.organization_id);
      setIsDeleteDialogOpen(false);
      setSelectedOrg(null);
    } catch (error) {
      console.error('Error eliminando organización:', error);
    }
  };

  if (role !== USER_TYPE.OWNER) {
    return (
      <Box className="grid place-items-center h-full">
        <div className="text-center">
          <h2 className="text-2xl font-bold mb-2">Acceso Denegado</h2>
          <p className="text-muted-foreground">
            Solo los usuarios OWNER pueden gestionar organizaciones.
          </p>
        </div>
      </Box>
    );
  }

  return (
    <Box className="grid grid-rows-[auto_1fr] h-full gap-4 p-4">
      <div className="flex items-center justify-between">
        <HeaderSection title="Organizaciones" />
        <Button onClick={handleCreate} className="gap-2">
          <Plus className="h-4 w-4" />
          Nueva Organización
        </Button>
      </div>

      <div className="overflow-auto">
        {isLoading && (
          <div className="flex items-center justify-center h-64">
            <p className="text-muted-foreground">Cargando organizaciones...</p>
          </div>
        )}

        {error && (
          <div className="flex items-center justify-center h-64">
            <p className="text-destructive">Error al cargar organizaciones</p>
          </div>
        )}

        {!isLoading && !error && organizations && organizations.length === 0 && (
          <div className="flex items-center justify-center h-64">
            <p className="text-muted-foreground">No hay organizaciones registradas</p>
          </div>
        )}

        {!isLoading && !error && organizations && organizations.length > 0 && (
          <div className="rounded-md border">
            <table className="w-full">
              <thead>
                <tr className="border-b bg-muted/50">
                  <th className="h-12 px-4 text-left align-middle font-medium">Nombre</th>
                  <th className="h-12 px-4 text-left align-middle font-medium">ID</th>
                  <th className="h-12 px-4 text-right align-middle font-medium">Acciones</th>
                </tr>
              </thead>
              <tbody>
                {organizations.map((org) => (
                  <tr key={org.organization_id} className="border-b hover:bg-muted/50">
                    <td className="p-4 align-middle font-medium">{org.name}</td>
                    <td className="p-4 align-middle text-sm text-muted-foreground">
                      {org.organization_id}
                    </td>
                    <td className="p-4 align-middle text-right">
                      <div className="flex justify-end gap-2">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleEdit(org)}
                          className="gap-2"
                        >
                          <Pencil className="h-4 w-4" />
                          Editar
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleDelete(org)}
                          className="gap-2 text-destructive hover:text-destructive"
                        >
                          <Trash2 className="h-4 w-4" />
                          Eliminar
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Dialog Crear */}
      <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Nueva Organización</DialogTitle>
            <DialogDescription>
              Ingresa el nombre de la nueva organización
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="name">Nombre</Label>
              <Input
                id="name"
                value={formName}
                onChange={(e) => setFormName(e.target.value)}
                placeholder="Ej: Mi Organización"
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setIsCreateDialogOpen(false)}
              disabled={createMutation.isPending}
            >
              Cancelar
            </Button>
            <Button
              onClick={handleSubmitCreate}
              disabled={!formName.trim() || createMutation.isPending}
            >
              {createMutation.isPending ? 'Creando...' : 'Crear'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog Editar */}
      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Editar Organización</DialogTitle>
            <DialogDescription>
              Modifica el nombre de la organización
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="edit-name">Nombre</Label>
              <Input
                id="edit-name"
                value={formName}
                onChange={(e) => setFormName(e.target.value)}
                placeholder="Ej: Mi Organización"
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setIsEditDialogOpen(false)}
              disabled={updateMutation.isPending}
            >
              Cancelar
            </Button>
            <Button
              onClick={handleSubmitEdit}
              disabled={!formName.trim() || updateMutation.isPending}
            >
              {updateMutation.isPending ? 'Guardando...' : 'Guardar'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog Eliminar */}
      <Dialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Eliminar Organización</DialogTitle>
            <DialogDescription>
              ¿Estás seguro de que deseas eliminar la organización "{selectedOrg?.name}"?
              Esta acción no se puede deshacer.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setIsDeleteDialogOpen(false)}
              disabled={deleteMutation.isPending}
            >
              Cancelar
            </Button>
            <Button
              variant="destructive"
              onClick={handleConfirmDelete}
              disabled={deleteMutation.isPending}
            >
              {deleteMutation.isPending ? 'Eliminando...' : 'Eliminar'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Box>
  );
};

export default OrganizationsContent;
