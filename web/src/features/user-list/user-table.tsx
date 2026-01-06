import { EditIcon, TrashIcon, KeyRound } from 'lucide-react';

import { Button } from '@/components/ui/button';
import {
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from '@/components/ui/table';

import { useUsers } from '@/hooks/fetchs/users/useUsers';
import SkeletonList from '@/components/skeletons/skeleton-list.tsx';
import { useDeleteUsers } from '@/hooks/mutations/users/useDeleteUser';
import { useResetPassword } from '@/hooks/mutations/users/useResetPassword';
import { toast } from 'react-hot-toast';
import React, { Suspense, useState } from 'react';
import { IUserEntityFront, USER_TYPE } from '@helper/types/user.type';
import { cashierTypeDictionary } from '@helper/functions/cashierTypeDictionary';
import { userTypeDictionary } from '@helper/functions/userTypeDictionary';
import { useAuth } from '@/contexts/AuthContext';
import { useUserListContext } from './UserListContext';

const UsersTable = () => {
  const {role} = useAuth()
  const { filterUserType } = useUserListContext();
  const [open, setOpen] = useState<boolean>(false);
  const [update, setUpdate] = useState<boolean>(false);
  const [resetPasswordOpen, setResetPasswordOpen] = useState<boolean>(false);
  const { data, isLoading, error } = useUsers(role, filterUserType);
  const [user, setUser] = useState<IUserEntityFront | undefined>(undefined);
  const { mutate: deleteUser, isPending } = useDeleteUsers();
  const { mutateAsync: resetPassword, isPending: isResettingPassword } = useResetPassword();
  const handleDeleteUser = (id: string) => {
    deleteUser(id, {
      onSuccess: () => {
        toast.success('Usuario eliminado con éxito');
        setOpen(false);
      },
      onError: () => {
        toast.error('Hubo un problema al eliminar al usuario');
      },
    });
  };

  const handleResetPassword = async (userId: string, newPassword: string) => {
    await resetPassword({ userId, newPassword });
  };

  if (isLoading) return <SkeletonList />;
  if (error) return <div>Error al obtener usuarios</div>;

  return (
    <div className="border border-dark-lighter rounded-lg overflow-hidden w-full h-full max-h-[calc(100vh-280px)] flex flex-col">
      <div className="overflow-y-auto flex-1">
        <table className="w-full caption-bottom text-sm">
          <thead className="bg-dark-light sticky top-0 z-10 [&_tr]:border-b">
            <TableRow>
              <TableHead className="text-white bg-dark-light">Numero</TableHead>
              <TableHead className="text-white bg-dark-light">Nombre</TableHead>
              <TableHead className="text-white bg-dark-light">Grupo</TableHead>
              <TableHead className="text-white bg-dark-light">Comision</TableHead>
              <TableHead className="text-white bg-dark-light">Deje</TableHead>
              <TableHead className="text-white bg-dark-light">Conexion</TableHead>
              <TableHead className="text-white bg-dark-light">Cuenta</TableHead>
              <TableHead className="text-white bg-dark-light">Editar</TableHead>
              <TableHead className="text-white bg-dark-light">Contraseña</TableHead>
              <TableHead className="text-white bg-dark-light">Eliminar</TableHead>
            </TableRow>
          </thead>
        <TableBody>
          {data && data.length === 0 ? (
            <TableRow>
              <TableCell colSpan={10} className="text-center py-8 text-muted-foreground">
                No hay usuarios disponibles
              </TableCell>
            </TableRow>
          ) : (
            data?.map((user: IUserEntityFront) => (
            <TableRow key={user.number} className="hover:bg-dark-lighter/50">
              <TableCell>{user.number}</TableCell>
              <TableCell>{user.name}</TableCell>
              <TableCell>{user.group_id}</TableCell>
              <TableCell>{user.user_type === USER_TYPE.CASHIER ? user.fee : '-'}</TableCell>
              <TableCell>{user.user_type === USER_TYPE.CASHIER ? user.fee_plus : '-'}</TableCell>
              <TableCell>{user.address}</TableCell>
              <TableCell>{`${userTypeDictionary[user.user_type] ?? ''}${user.user_type === USER_TYPE.CASHIER ? ` - ${cashierTypeDictionary[user.cashier_type]}` : ''}`}</TableCell>
              <TableCell>
                <Button
                  variant="ghost"
                  className="hover:text-cyan"
                  size={'icon'}
                  onClick={() => {
                    setUser(user);
                    setUpdate(true);
                  }}
                >
                  <EditIcon />
                </Button>
              </TableCell>
              <TableCell>
                <Button
                  variant="ghost"
                  className="hover:text-yellow-500"
                  size={'icon'}
                  onClick={() => {
                    setUser(user);
                    setResetPasswordOpen(true);
                  }}
                >
                  <KeyRound />
                </Button>
              </TableCell>
              <TableCell className={'flex justify-center items-center'}>
                <Button
                  variant="ghost"
                  className="hover:text-destructive"
                  size={'icon'}
                  onClick={() => {
                    setUser(user);
                    setOpen(true);
                  }}
                >
                  <TrashIcon />
                </Button>
              </TableCell>
            </TableRow>
          )))}
        </TableBody>
        </table>
      </div>
      <Suspense fallback={<div>Cargando...</div>}>
        <DeleteUsersModal
          isOpen={open}
          onClose={() => setOpen(false)}
          onClick={handleDeleteUser}
          isPending={isPending}
          user={user}
        />
      </Suspense>
      <Suspense fallback={<div>Cargando...</div>}>
        <UpdateUserModal isOpen={update} onClose={() => setUpdate(false)} user={user} />
      </Suspense>
      <Suspense fallback={<div>Cargando...</div>}>
        <ResetPasswordModal
          isOpen={resetPasswordOpen}
          onClose={() => setResetPasswordOpen(false)}
          user={user}
          onConfirm={handleResetPassword}
          isPending={isResettingPassword}
        />
      </Suspense>
    </div>
  );
};

export default UsersTable;
const DeleteUsersModal = React.lazy(
  () => import('../../../src/components/modals/DeleteUsersModal')
);
const UpdateUserModal = React.lazy(() => import('../../../src/components/modals/UpdateUserModal'));
const ResetPasswordModal = React.lazy(() => import('../../../src/components/modals/ResetPasswordModal'));
