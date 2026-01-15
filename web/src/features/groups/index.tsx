import { useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { UsersIcon, Users2Icon, Plus, Trash2, RefreshCw } from 'lucide-react';

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
import { useAssignableUsers } from '@/hooks/fetchs/users/useAssignableUsers';
import { useGroupUsers } from '@/hooks/fetchs/users/useGroupUsers';
import { useAssignUserToGroup } from '@/hooks/mutations/users/useAssignUserToGroup';
import { IOrganizationEntityFront } from '@helper/types/organization.type';
import { IUserEntityFront, USER_TYPE } from '@helper/types/user.type';
import { INewUserEntity } from '@helper/request/user.request';
import { userTypeDictionary } from '@helper/functions/userTypeDictionary';

interface CreateGroupForm {
  organization: { name: string };
  superAdmin?: {
    name: string;
    username: string;
    password: string;
    last_name?: string;
    email?: string;
    phone?: number;
    address?: string;
  };
}

const UserGroupsContent = () => {
  const { role, organizationId } = useAuth();
  const { data: groups, isLoading, refetch } = useGroups(organizationId, role);
  const createGroupMutation = useCreateGroup();
  const assignUserMutation = useAssignUserToGroup();

  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [includeSuperAdmin, setIncludeSuperAdmin] = useState(false);
  const [selectedGroup, setSelectedGroup] = useState<IOrganizationEntityFront | null>(null);
  const [isAssignDialogOpen, setIsAssignDialogOpen] = useState(false);

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
      superAdmin: {
        name: '',
        username: '',
        password: '',
        last_name: '',
        email: '',
        address: '',
      },
    },
  });

  const handleCreate = () => {
    reset();
    setIncludeSuperAdmin(false);
    setIsCreateDialogOpen(true);
  };

  const handleSubmitCreate = async (data: CreateGroupForm) => {
    if (!organizationId) return;

    try {
      const payload: {
        parentOrgId: string;
        organization: { name: string };
        superAdmin?: INewUserEntity;
      } = {
        parentOrgId: organizationId,
        organization: data.organization,
      };

      if (includeSuperAdmin && data.superAdmin) {
        payload.superAdmin = {
          ...data.superAdmin,
          number: null,
          user_type: USER_TYPE.SUPERADMIN,
          cashier_type: null,
          fee: null,
          fee_plus: null,
        } as INewUserEntity;
      }

      await createGroupMutation.mutateAsync(payload);
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

  // Solo OWNER y CAPITALIST pueden ver grupos
  if (!role || ![USER_TYPE.OWNER, USER_TYPE.CAPITALIST].includes(role)) {
    return (
      <Box className="grid place-items-center h-full">
        <div className="text-center">
          <h2 className="text-2xl font-bold mb-2">Acceso Denegado</h2>
          <p className="text-muted-foreground">
            Solo los usuarios OWNER y CAPITALIST pueden gestionar grupos.
          </p>
        </div>
      </Box>
    );
  }

  return (
    <Box className={'grid grid-rows-[auto_1fr_auto] h-full'}>
      <HeaderSection title={'Lista de Grupos'}>
        <Flex className={'justify-end gap-4'}>
          <Button variant={'outline'} onClick={handleCreate} className="gap-2">
            <Plus className="h-4 w-4" />
            Nuevo Grupo
          </Button>
          <Button variant={'outline'} onClick={() => refetch()} className="gap-2">
            <RefreshCw className="h-4 w-4" />
            Actualizar
          </Button>
        </Flex>
      </HeaderSection>

      <FlexCol className={'py-[36px]'}>
        <Box className={'grid grid-cols-2 gap-8'}>
          <FlexCol>
            <HeaderTitleSection
              title={'Grupos'}
              icon={<Users2Icon size="24px" />}
              className={'!mb-[36px]'}
            />
            <Flex className={'border border-dark-lighter rounded-lg overflow-hidden w-full'}>
              <Table>
                <TableHeader className="bg-dark-light">
                  <TableRow>
                    <TableHead className="text-white">Nombre</TableHead>
                    <TableHead className="text-white">ID</TableHead>
                    <TableHead className="text-white text-right">Acciones</TableHead>
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
                          className="font-medium cursor-pointer hover:text-primary"
                          onClick={() => setSelectedGroup(group)}
                        >
                          {group.name}
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {group.organization_id.slice(0, 8)}...
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-2">
                            <Button
                              variant="ghost"
                              size="sm"
                              className="gap-1 text-destructive hover:text-destructive"
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </TableCell>
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
            </Flex>
          </FlexCol>

          <FlexCol>
            <div className="flex justify-between items-center !mb-[36px]">
              <HeaderTitleSection
                title={'Usuarios del Grupo'}
                icon={<UsersIcon size="24px" />}
                className={'!mb-0'}
              />
              {selectedGroup && (
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
                <Flex className={'border border-dark-lighter rounded-lg overflow-hidden w-full'}>
                  <Table>
                    <TableHeader className="bg-dark-light">
                      <TableRow>
                        <TableHead className="text-white">Número</TableHead>
                        <TableHead className="text-white">Nombre</TableHead>
                        <TableHead className="text-white">Tipo</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {isLoadingGroupUsers ? (
                        <TableRow>
                          <TableCell colSpan={3} className="text-center py-8 text-muted-foreground">
                            Cargando usuarios...
                          </TableCell>
                        </TableRow>
                      ) : groupUsers && groupUsers.length > 0 ? (
                        groupUsers.map((user) => (
                          <TableRow key={user.user_id} className="hover:bg-dark-lighter/50">
                            <TableCell>{user.number ?? '-'}</TableCell>
                            <TableCell className="font-medium">{user.name} {user.last_name}</TableCell>
                            <TableCell>{userTypeDictionary[user.user_type] ?? user.user_type}</TableCell>
                          </TableRow>
                        ))
                      ) : (
                        <TableRow>
                          <TableCell colSpan={3} className="text-center py-8 text-muted-foreground">
                            No hay usuarios en este grupo
                          </TableCell>
                        </TableRow>
                      )}
                    </TableBody>
                  </Table>
                </Flex>
              </div>
            ) : (
              <div className="border border-dark-lighter rounded-lg p-4 text-center text-muted-foreground">
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

            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="include-superadmin"
                checked={includeSuperAdmin}
                onChange={(e) => setIncludeSuperAdmin(e.target.checked)}
                className="rounded"
              />
              <Label htmlFor="include-superadmin" className="cursor-pointer">
                Crear SUPERADMIN para este grupo
              </Label>
            </div>

            {includeSuperAdmin && (
              <fieldset className="border px-4 py-4 rounded-md">
                <legend className="px-2 text-sm font-semibold">Datos del SUPERADMIN</legend>
                <div className="grid gap-4 pt-2">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="grid gap-2">
                      <Label htmlFor="sa-username">Usuario</Label>
                      <Controller
                        name="superAdmin.username"
                        control={control}
                        rules={{ required: includeSuperAdmin ? 'El usuario es requerido' : false }}
                        render={({ field }) => <Input id="sa-username" {...field} />}
                      />
                      {errors.superAdmin?.username && (
                        <p className="text-sm text-destructive">
                          {errors.superAdmin.username.message}
                        </p>
                      )}
                    </div>
                    <div className="grid gap-2">
                      <Label htmlFor="sa-password">Contraseña</Label>
                      <Controller
                        name="superAdmin.password"
                        control={control}
                        rules={{
                          required: includeSuperAdmin ? 'La contraseña es requerida' : false,
                        }}
                        render={({ field }) => (
                          <Input id="sa-password" type="password" {...field} />
                        )}
                      />
                      {errors.superAdmin?.password && (
                        <p className="text-sm text-destructive">
                          {errors.superAdmin.password.message}
                        </p>
                      )}
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="grid gap-2">
                      <Label htmlFor="sa-name">Nombre</Label>
                      <Controller
                        name="superAdmin.name"
                        control={control}
                        rules={{ required: includeSuperAdmin ? 'El nombre es requerido' : false }}
                        render={({ field }) => <Input id="sa-name" {...field} />}
                      />
                      {errors.superAdmin?.name && (
                        <p className="text-sm text-destructive">{errors.superAdmin.name.message}</p>
                      )}
                    </div>
                    <div className="grid gap-2">
                      <Label htmlFor="sa-last_name">Apellido</Label>
                      <Controller
                        name="superAdmin.last_name"
                        control={control}
                        render={({ field }) => (
                          <Input id="sa-last_name" {...field} value={field.value ?? ''} />
                        )}
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="grid gap-2">
                      <Label htmlFor="sa-email">Email</Label>
                      <Controller
                        name="superAdmin.email"
                        control={control}
                        render={({ field }) => (
                          <Input
                            id="sa-email"
                            type="email"
                            {...field}
                            value={field.value ?? ''}
                          />
                        )}
                      />
                    </div>
                    <div className="grid gap-2">
                      <Label htmlFor="sa-address">Dirección</Label>
                      <Controller
                        name="superAdmin.address"
                        control={control}
                        render={({ field }) => (
                          <Input id="sa-address"  {...field} value={field.value ?? ''}/>
                        )}
                      />
                    </div>
                  </div>
                </div>
              </fieldset>
            )}

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
