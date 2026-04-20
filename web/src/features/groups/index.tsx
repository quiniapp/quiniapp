import { useEffect, useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { UsersIcon, Users2Icon, Plus, Trash2, RefreshCw, Pencil } from 'lucide-react';
import toast from 'react-hot-toast';

import Box from '@/components/box';
import { Flex, FlexCol } from '@/components/flex';
import HeaderSection from '@/components/header-section';
import HeaderTitleSection from '@/components/header-title-section';
import { Button } from '@/components/ui/button';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
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

import { useAuth } from '@/contexts/AuthContext';
import { useGroups } from '@/hooks/fetchs/organization/useGroups';
import { useCreateGroup } from '@/hooks/mutations/organization/useCreateGroup';
import { useDeleteGroup } from '@/hooks/mutations/organization/useDeleteGroup';
import { useUpdateGroup } from '@/hooks/mutations/organization/useUpdateGroup';
import { useAssignableUsers } from '@/hooks/fetchs/users/useAssignableUsers';
import { useGroupUsers } from '@/hooks/fetchs/users/useGroupUsers';
import { useAssignUserToGroup } from '@/hooks/mutations/users/useAssignUserToGroup';
import { useRemoveUserFromGroup } from '@/hooks/mutations/users/useRemoveUserFromGroup';
import { IOrganizationEntityFront } from '@helper/types/organization.type';
import { IUserEntityFront, USER_TYPE } from '@helper/types/user.type';
import { userTypeDictionary } from '@helper/functions/userTypeDictionary';

interface CreateGroupForm {
  organization: { name: string };
}

const MANAGE_ROLES = [USER_TYPE.OWNER, USER_TYPE.CAPITALIST, USER_TYPE.SUPERADMIN];

const UserGroupsContent = () => {
  const { role, organizationId, groupId } = useAuth();
  const { data: groups, isLoading, refetch } = useGroups(organizationId, role);
  const createGroupMutation = useCreateGroup();
  const deleteGroupMutation = useDeleteGroup(organizationId);
  const updateGroupMutation = useUpdateGroup(organizationId);
  const assignUserMutation = useAssignUserToGroup();
  const removeUserMutation = useRemoveUserFromGroup();

  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [selectedGroup, setSelectedGroup] = useState<IOrganizationEntityFront | null>(null);
  const [isAssignDialogOpen, setIsAssignDialogOpen] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [groupToDelete, setGroupToDelete] = useState<IOrganizationEntityFront | null>(null);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [groupToEdit, setGroupToEdit] = useState<IOrganizationEntityFront | null>(null);
  const [editName, setEditName] = useState('');

  // Get assignable users (excluding those already in the selected group)
  const { data: assignableUsers, isLoading: isLoadingUsers } = useAssignableUsers(
    role,
    selectedGroup?.organization_id
  );

  // Get users that belong to the selected group
  const { data: groupUsers, isLoading: isLoadingGroupUsers } = useGroupUsers(
    selectedGroup?.organization_id || null,
    role
  );

  const {
    handleSubmit,
    control,
    reset,
    formState: { errors },
  } = useForm<CreateGroupForm>({
    mode: 'onBlur',
    defaultValues: {
      organization: { name: '' },
    },
  });

  const handleCreate = () => {
    reset();
    setIsCreateDialogOpen(true);
  };

  const handleSubmitCreate = async (data: CreateGroupForm) => {
    if (!organizationId) return;

    try {
      await createGroupMutation.mutateAsync({
        parentOrgId: organizationId,
        organization: data.organization,
      });
      setIsCreateDialogOpen(false);
      reset();
    } catch (error) {
      console.error('Error creando grupo:', error);
    }
  };

  const handleAssignUser = async (user: IUserEntityFront) => {
    if (!selectedGroup) return;

    try {
      await assignUserMutation.mutateAsync({
        user_id: user.user_id,
        group_id: selectedGroup.organization_id,
      });
    } catch (error) {
      console.error('Error asignando usuario:', error);
    }
  };

  const handleRemoveUser = async (user: IUserEntityFront) => {
    if (!selectedGroup) return;

    try {
      await removeUserMutation.mutateAsync({
        user_id: user.user_id,
        group_id: selectedGroup.organization_id,
      });
    } catch (error) {
      console.error('Error eliminando usuario del grupo:', error);
    }
  };

  const handleDeleteGroup = (group: IOrganizationEntityFront) => {
    setGroupToDelete(group);
    setIsDeleteDialogOpen(true);
  };

  const handleConfirmDelete = async () => {
    if (!groupToDelete) return;
    try {
      await deleteGroupMutation.mutateAsync(groupToDelete.organization_id);
      toast.success('Grupo eliminado. Los usuarios fueron devueltos a la organización.');
      if (selectedGroup?.organization_id === groupToDelete.organization_id) {
        setSelectedGroup(null);
      }
      setIsDeleteDialogOpen(false);
      setGroupToDelete(null);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Error al eliminar grupo');
    }
  };

  const handleEditGroup = (group: IOrganizationEntityFront) => {
    setGroupToEdit(group);
    setEditName(group.name);
    setIsEditDialogOpen(true);
  };

  const handleConfirmEdit = async () => {
    if (!groupToEdit || !editName.trim()) return;
    try {
      await updateGroupMutation.mutateAsync({
        group_id: groupToEdit.organization_id,
        name: editName.trim(),
      });
      toast.success('Grupo actualizado.');
      setIsEditDialogOpen(false);
      setGroupToEdit(null);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Error al actualizar grupo');
    }
  };

  const canManage = !!role && MANAGE_ROLES.includes(role);
  const adminHasGroup = role === USER_TYPE.ADMIN && !!groupId && groupId !== organizationId;

  // ADMIN with group: auto-select their group when groups load
  useEffect(() => {
    if (adminHasGroup && groups?.length) {
      const myGroup = groups.find((g) => g.organization_id === groupId);
      if (myGroup) setSelectedGroup(myGroup);
    }
  }, [adminHasGroup, groupId, groups]);

  const allowedRoles = [...MANAGE_ROLES, USER_TYPE.ADMIN];
  if (!role || !allowedRoles.includes(role)) {
    return (
      <Box className="grid place-items-center h-full">
        <div className="text-center">
          <h2 className="text-2xl font-bold mb-2">Acceso Denegado</h2>
          <p className="text-muted-foreground">
            No tienes permisos para ver esta página.
          </p>
        </div>
      </Box>
    );
  }

  return (
    <Box className={'grid grid-rows-[auto_1fr_auto] h-full'}>
      <HeaderSection title={'Lista de Grupos'}>
        <Flex className={'justify-end gap-4'}>
          {canManage && (
            <Button variant={'outline'} onClick={handleCreate} className="gap-2">
              <Plus className="h-4 w-4" />
              Nuevo Grupo
            </Button>
          )}
          <Button variant={'outline'} onClick={() => refetch()} className="gap-2">
            <RefreshCw className="h-4 w-4" />
            Actualizar
          </Button>
        </Flex>
      </HeaderSection>

      <FlexCol className={'py-[36px]'}>
        <Box className={'grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-8'}>
          <FlexCol>
            <HeaderTitleSection
              title={'Grupos'}
              icon={<Users2Icon size="24px" />}
              className={'!mb-[36px]'}
            />
            <div className="border border-dark-lighter rounded-lg overflow-x-auto w-full">
              <Table className="min-w-[300px]">
                <TableHeader className="bg-dark-light">
                  <TableRow>
                    <TableHead className="text-white">Nombre</TableHead>
                    <TableHead className="text-white">ID</TableHead>
                    {canManage && <TableHead className="text-white text-right">Acciones</TableHead>}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {isLoading ? (
                    <TableRow>
                      <TableCell colSpan={3} className="text-center py-8 text-muted-foreground">
                        Cargando grupos...
                      </TableCell>
                    </TableRow>
                  ) : groups && groups.length > 0 ? (
                    groups.map((group) => (
                      <TableRow
                        key={group.organization_id}
                        className={`hover:bg-dark-lighter/50 ${selectedGroup?.organization_id === group.organization_id ? 'bg-dark-lighter/30' : ''}`}
                      >
                        <TableCell
                          className={`font-medium ${!adminHasGroup ? 'cursor-pointer hover:text-primary' : ''}`}
                          onClick={() => !adminHasGroup && setSelectedGroup(group)}
                        >
                          {group.name}
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {group.organization_id.slice(0, 8)}...
                        </TableCell>
                        {canManage && (
                          <TableCell className="text-right">
                            <div className="flex justify-end gap-2">
                              <Button
                                variant="ghost"
                                size="icon"
                                className="hover:text-cyan"
                                onClick={() => handleEditGroup(group)}
                              >
                                <Pencil className="h-4 w-4" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="text-destructive hover:text-destructive"
                                onClick={() => handleDeleteGroup(group)}
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </div>
                          </TableCell>
                        )}
                      </TableRow>
                    ))
                  ) : (
                    <TableRow>
                      <TableCell colSpan={3} className="text-center py-8 text-muted-foreground">
                        No hay grupos disponibles
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
          </FlexCol>

          <FlexCol>
            <div className="flex justify-between items-center !mb-[36px]">
              <HeaderTitleSection
                title={'Usuarios del Grupo'}
                icon={<UsersIcon size="24px" />}
                className={'!mb-0'}
              />
              {selectedGroup && canManage && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setIsAssignDialogOpen(true)}
                  className="gap-1"
                >
                  <Plus className="h-4 w-4" />
                  Asignar Usuario
                </Button>
              )}
            </div>
            {selectedGroup ? (
              <div className="space-y-4">
                <p className="text-sm text-muted-foreground">
                  Grupo: <strong>{selectedGroup.name}</strong> - Los usuarios asignados solo verán datos de este grupo.
                </p>
                <div className="border border-dark-lighter rounded-lg overflow-x-auto w-full">
                  <Table className="min-w-[300px]">
                    <TableHeader className="bg-dark-light">
                      <TableRow>
                        <TableHead className="text-white">Número</TableHead>
                        <TableHead className="text-white">Nombre</TableHead>
                        <TableHead className="text-white">Tipo</TableHead>
                        {canManage && <TableHead className="text-white text-right">Acciones</TableHead>}
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {isLoadingGroupUsers ? (
                        <TableRow>
                          <TableCell colSpan={4} className="text-center py-8 text-muted-foreground">
                            Cargando usuarios...
                          </TableCell>
                        </TableRow>
                      ) : groupUsers && groupUsers.length > 0 ? (
                        groupUsers.map((user) => (
                          <TableRow key={user.user_id} className="hover:bg-dark-lighter/50">
                            <TableCell>{user.number ?? '-'}</TableCell>
                            <TableCell className="font-medium">{user.name} {user.last_name}</TableCell>
                            <TableCell>{userTypeDictionary[user.user_type] ?? user.user_type}</TableCell>
                            {canManage && (
                              <TableCell className="text-right">
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="gap-1 text-destructive hover:text-destructive"
                                  onClick={() => handleRemoveUser(user)}
                                  disabled={removeUserMutation.isPending}
                                >
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              </TableCell>
                            )}
                          </TableRow>
                        ))
                      ) : (
                        <TableRow>
                          <TableCell colSpan={4} className="text-center py-8 text-muted-foreground">
                            No hay usuarios en este grupo
                          </TableCell>
                        </TableRow>
                      )}
                    </TableBody>
                  </Table>
                </div>
              </div>
            ) : (
              <div className="border border-dark-lighter rounded-lg p-4 text-center text-muted-foreground min-h-[160px] flex items-center justify-center">
                Selecciona un grupo para ver sus usuarios
              </div>
            )}
          </FlexCol>
        </Box>
      </FlexCol>

      {/* Dialog Crear Grupo */}
      <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Nuevo Grupo</DialogTitle>
            <DialogDescription>
              Crea un nuevo grupo (sub-organización). El grupo heredará la configuración de
              loterías y horarios.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleSubmit(handleSubmitCreate)} className="space-y-6">
            <fieldset className="border px-4 py-4 rounded-md">
              <legend className="px-2 text-sm font-semibold">Datos del Grupo</legend>
              <div className="grid gap-4 pt-2">
                <div className="grid gap-2">
                  <Label htmlFor="group-name">Nombre del Grupo</Label>
                  <Controller
                    name="organization.name"
                    control={control}
                    rules={{ required: 'El nombre del grupo es requerido' }}
                    render={({ field }) => (
                      <Input id="group-name" placeholder="Ej: Grupo Norte" {...field} />
                    )}
                  />
                  {errors.organization?.name && (
                    <p className="text-sm text-destructive">{errors.organization.name.message}</p>
                  )}
                </div>
              </div>
            </fieldset>

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setIsCreateDialogOpen(false)}
                disabled={createGroupMutation.isPending}
              >
                Cancelar
              </Button>
              <Button type="submit" disabled={createGroupMutation.isPending}>
                {createGroupMutation.isPending ? 'Creando...' : 'Crear Grupo'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Dialog Editar Grupo */}
      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Editar Grupo</DialogTitle>
            <DialogDescription>Cambia el nombre del grupo.</DialogDescription>
          </DialogHeader>
          <div className="grid gap-2 py-4">
            <Label htmlFor="edit-group-name">Nombre</Label>
            <Input
              id="edit-group-name"
              value={editName}
              onChange={(e) => setEditName(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleConfirmEdit()}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsEditDialogOpen(false)} disabled={updateGroupMutation.isPending}>
              Cancelar
            </Button>
            <Button onClick={handleConfirmEdit} disabled={!editName.trim() || updateGroupMutation.isPending}>
              {updateGroupMutation.isPending ? 'Guardando...' : 'Guardar'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog Confirmar Eliminar Grupo */}
      <Dialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Eliminar Grupo</DialogTitle>
            <DialogDescription>
              ¿Estás seguro de que deseas eliminar el grupo <strong>{groupToDelete?.name}</strong>?
              Los usuarios del grupo volverán a pertenecer a la organización.
              Esta acción no se puede deshacer.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsDeleteDialogOpen(false)} disabled={deleteGroupMutation.isPending}>
              Cancelar
            </Button>
            <Button variant="destructive" onClick={handleConfirmDelete} disabled={deleteGroupMutation.isPending}>
              {deleteGroupMutation.isPending ? 'Eliminando...' : 'Eliminar'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog Asignar Usuario */}
      <Dialog open={isAssignDialogOpen} onOpenChange={setIsAssignDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Asignar Usuario al Grupo</DialogTitle>
            <DialogDescription>
              Selecciona un usuario para asignar al grupo{' '}
              <strong>{selectedGroup?.name}</strong>. El usuario pasara a ver
              solo los datos de este grupo.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            {isLoadingUsers ? (
              <div className="text-center py-8 text-muted-foreground">
                Cargando usuarios...
              </div>
            ) : assignableUsers && assignableUsers.length > 0 ? (
              <Table>
                <TableHeader className="bg-dark-light">
                  <TableRow>
                    <TableHead className="text-white">Numero</TableHead>
                    <TableHead className="text-white">Nombre</TableHead>
                    <TableHead className="text-white">Tipo</TableHead>
                    <TableHead className="text-white text-right">Accion</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {assignableUsers.map((user) => (
                    <TableRow key={user.user_id} className="hover:bg-dark-lighter/50">
                      <TableCell>{user.number ?? '-'}</TableCell>
                      <TableCell>{user.name}</TableCell>
                      <TableCell>{userTypeDictionary[user.user_type] ?? user.user_type}</TableCell>
                      <TableCell className="text-right">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleAssignUser(user)}
                          disabled={assignUserMutation.isPending}
                        >
                          {assignUserMutation.isPending ? 'Asignando...' : 'Asignar'}
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            ) : (
              <div className="text-center py-8 text-muted-foreground">
                No hay usuarios disponibles para asignar
              </div>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsAssignDialogOpen(false)}>
              Cerrar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Box>
  );
};

export default UserGroupsContent;
