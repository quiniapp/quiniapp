import { useState, Suspense } from 'react';
import { Controller, useForm } from 'react-hook-form';
import Box from '@/components/box';
import HeaderSection from '@/components/header-section';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/contexts/AuthContext';
import { useOrganizations } from '@/hooks/fetchs/organization/useOrganizations';
import { useCreateOrganization } from '@/hooks/mutations/organization/useCreateOrganization';
import { useUpdateOrganization } from '@/hooks/mutations/organization/useUpdateOrganization';
import { useDeleteOrganization } from '@/hooks/mutations/organization/useDeleteOrganization';
import { useResetPassword } from '@/hooks/mutations/users/useResetPassword';
import { Plus, Pencil, Trash2, KeyRound } from 'lucide-react';
import { IOrganizationEntityFront } from '@helper/types/organization.type';
import { USER_TYPE } from '@helper/types/user.type';
import { INewUserEntity } from '@helper/request/user.request';
import { INewOrganizationEntity } from '@helper/request/organization.request';
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
import React from 'react';

type CreateOrganizationWithSuperAdminForm = {
  organization: INewOrganizationEntity;
  superAdmin: INewUserEntity;
};

const OrganizationsContent = () => {
  const { role } = useAuth();
  const { data: organizations, isLoading, error } = useOrganizations(role);
  const createMutation = useCreateOrganization();
  const updateMutation = useUpdateOrganization();
  const deleteMutation = useDeleteOrganization();
  const { mutateAsync: resetPassword, isPending: isResettingPassword } = useResetPassword();

  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [isResetPasswordOpen, setIsResetPasswordOpen] = useState(false);
  const [selectedOrg, setSelectedOrg] = useState<IOrganizationEntityFront | null>(null);
  const [formName, setFormName] = useState('');

  // React Hook Form for create organization with capitalista
  const {
    handleSubmit,
    control,
    reset,
    formState: { errors },
  } = useForm<CreateOrganizationWithSuperAdminForm>({
    mode: 'onBlur',
    defaultValues: {
      organization: {
        name: '',
      },
      superAdmin: {
        number: null,
        name: '',
        user_type: USER_TYPE.CAPITALIST,
        cashier_type: null,
        fee: null,
        fee_plus: null,
        username: '',
        password: '',
        last_name: '',
        address: '',
        phone: undefined,
        email: '',
      },
    },
  });

  const handleCreate = () => {
    reset();
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

  const handleResetPassword = (org: IOrganizationEntityFront) => {
    setSelectedOrg(org);
    setIsResetPasswordOpen(true);
  };

  const handleResetPasswordConfirm = async (userId: string, newPassword: string) => {
    await resetPassword({ userId, newPassword });
  };

  const handleSubmitCreate = async (data: CreateOrganizationWithSuperAdminForm) => {
    try {
      await createMutation.mutateAsync(data);
      setIsCreateDialogOpen(false);
      reset();
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
          <div className="rounded-md border overflow-x-auto w-full">
            <table className="w-full min-w-[500px]">
              <thead>
                <tr className="border-b bg-muted/50">
                  <th className="h-12 px-4 text-left align-middle font-medium">Nombre</th>
                  <th className="h-12 px-4 text-left align-middle font-medium hidden sm:table-cell">ID</th>
                  <th className="h-12 px-4 text-right align-middle font-medium">Acciones</th>
                </tr>
              </thead>
              <tbody>
                {organizations.map((org) => (
                  <tr key={org.organization_id} className="border-b hover:bg-muted/50">
                    <td className="p-4 align-middle font-medium">{org.name}</td>
                    <td className="p-4 align-middle text-sm text-muted-foreground hidden sm:table-cell">
                      <span title={org.organization_id}>{org.organization_id.slice(0, 8)}...</span>
                    </td>
                    <td className="p-4 align-middle text-right">
                      <div className="flex justify-end gap-1 sm:gap-2">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleEdit(org)}
                          className="gap-1 sm:gap-2"
                        >
                          <Pencil className="h-4 w-4" />
                          <span className="hidden sm:inline">Editar</span>
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleResetPassword(org)}
                          className="gap-1 sm:gap-2 text-yellow-600 hover:text-yellow-500"
                        >
                          <KeyRound className="h-4 w-4" />
                          <span className="hidden sm:inline">Resetear Contraseña</span>
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleDelete(org)}
                          className="gap-1 sm:gap-2 text-destructive hover:text-destructive"
                        >
                          <Trash2 className="h-4 w-4" />
                          <span className="hidden sm:inline">Eliminar</span>
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
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Nueva Organización con Capitalista</DialogTitle>
            <DialogDescription>
              Ingresa los datos de la organización y del usuario Capitalista
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSubmit(handleSubmitCreate)} className="space-y-6">
            <fieldset className="border px-4 py-4 rounded-md">
              <legend className="px-2 text-sm font-semibold">Datos de la Organización</legend>
              <div className="grid gap-4 pt-2">
                <div className="grid gap-2">
                  <Label htmlFor="org-name">Nombre de la Organización</Label>
                  <Controller
                    name="organization.name"
                    control={control}
                    rules={{ required: 'El nombre de la organización es requerido' }}
                    render={({ field }) => (
                      <Input
                        id="org-name"
                        placeholder="Ej: Mi Organización"
                        {...field}
                      />
                    )}
                  />
                  {errors.organization?.name && (
                    <p className="text-sm text-destructive">{errors.organization.name.message}</p>
                  )}
                </div>
              </div>
            </fieldset>

            <fieldset className="border px-4 py-4 rounded-md">
              <legend className="px-2 text-sm font-semibold">Datos del Capitalista</legend>
              <div className="grid gap-4 pt-2">
                

                <div className="grid grid-cols-2 gap-4">
                  <div className="grid gap-2">
                    <Label htmlFor="username">Usuario</Label>
                    <Controller
                      name="superAdmin.username"
                      control={control}
                      rules={{ required: 'El usuario es requerido' }}
                      render={({ field: { value, ...rest } }) => (
                        <Input id="username" value={value ?? ''} {...rest} />
                      )}
                    />
                    {errors.superAdmin?.username && (
                      <p className="text-sm text-destructive">{errors.superAdmin.username.message}</p>
                    )}
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="password">Contraseña (min 6 caracteres)</Label>
                    <Controller
                      name="superAdmin.password"
                      control={control}
                      rules={{ required: 'La contraseña es requerida' }}
                      render={({ field }) => (
                        <Input id="password" type="password" {...field} />
                      )}
                    />
                    {errors.superAdmin?.password && (
                      <p className="text-sm text-destructive">{errors.superAdmin.password.message}</p>
                    )}
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="grid gap-2">
                    <Label htmlFor="user-name">Nombre</Label>
                    <Controller
                      name="superAdmin.name"
                      control={control}
                      rules={{ required: 'El nombre es requerido' }}
                      render={({ field }) => <Input id="user-name" {...field} />}
                    />
                    {errors.superAdmin?.name && (
                      <p className="text-sm text-destructive">{errors.superAdmin.name.message}</p>
                    )}
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="last_name">Apellido</Label>
                    <Controller
                      name="superAdmin.last_name"
                      control={control}
                      render={({ field: { value, ...rest } }) => (
                        <Input id="last_name" value={value ?? ''} {...rest} />
                      )}
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="grid gap-2">
                    <Label htmlFor="email">Email</Label>
                    <Controller
                      name="superAdmin.email"
                      control={control}
                      render={({ field: { value, ...rest } }) => (
                        <Input id="email" type="email" value={value ?? ''} {...rest} />
                      )}
                    />
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="phone">Teléfono</Label>
                    <Controller
                      name="superAdmin.phone"
                      control={control}
                      render={({ field: { value, ...rest } }) => (
                        <Input id="phone" type="tel" value={value ?? ''} {...rest} />
                      )}
                    />
                  </div>
                </div>

                <div className="grid gap-2">
                  <Label htmlFor="address">Dirección</Label>
                  <Controller
                    name="superAdmin.address"
                    control={control}
                    render={({ field: { value, ...rest } }) => (
                      <Input id="address" value={value ?? ''} {...rest} />
                    )}
                  />
                </div>
              </div>
            </fieldset>

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setIsCreateDialogOpen(false)}
                disabled={createMutation.isPending}
              >
                Cancelar
              </Button>
              <Button type="submit" disabled={createMutation.isPending}>
                {createMutation.isPending ? 'Creando...' : 'Crear Organización y Capitalista'}
              </Button>
            </DialogFooter>
          </form>
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

      {/* Dialog Resetear Contraseña */}
      <Suspense fallback={<div>Cargando...</div>}>
        <ResetSuperAdminPasswordModal
          isOpen={isResetPasswordOpen}
          onClose={() => setIsResetPasswordOpen(false)}
          organization={selectedOrg}
          onConfirm={handleResetPasswordConfirm}
          isPending={isResettingPassword}
        />
      </Suspense>
    </Box>
  );
};

export default OrganizationsContent;

const ResetSuperAdminPasswordModal = React.lazy(
  () => import('../../components/modals/ResetSuperAdminPasswordModal')
);
