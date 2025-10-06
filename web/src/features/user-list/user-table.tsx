import { EditIcon, TrashIcon } from 'lucide-react';

import { Button } from '@/components/ui/button';
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from '@/components/ui/table';

import { useUsers } from '@/hooks/fetchs/users/useUsers';
import SkeletonList from '@/components/skeletons/skeleton-list.tsx';
import { useDeleteUsers } from '@/hooks/mutations/users/useDeleteUser';
import { toast } from 'react-hot-toast';
import React, { Suspense, useState } from 'react';
import { IUserEntityFront, USER_TYPE } from '@helper/types/user.type';
import { cashierTypeDictionary } from '@helper/functions/cashierTypeDictionary';
import { userTypeDictionary } from '@helper/functions/userTypeDictionary';
import { useAuth } from '@/contexts/AuthContext';

const UsersTable = () => {
  const {role} = useAuth()
  const [open, setOpen] = useState<boolean>(false);
  const [update, setUpdate] = useState<boolean>(false);
  const { data, isLoading, error } = useUsers(role);
  const [user, setUser] = useState<IUserEntityFront | undefined>(undefined);
  const { mutate: deleteUser, isPending } = useDeleteUsers();
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

  if (isLoading) return <SkeletonList />;
  if (error) return <div>Error al obtener usuarios</div>;

  return (
    <div className="border border-dark-lighter rounded-lg overflow-hidden w-full">
      <Table>
        <TableHeader className="bg-dark-light">
          <TableRow>
            <TableHead className="text-cyan">Numero</TableHead>
            <TableHead className="text-cyan">Nombre</TableHead>
            <TableHead className="text-cyan">Grupo</TableHead>
            <TableHead className="text-cyan">Comision</TableHead>
            <TableHead className="text-cyan">Deje</TableHead>
            <TableHead className="text-cyan">Conexion</TableHead>
            <TableHead className="text-cyan">Cuenta</TableHead>
            <TableHead className="text-cyan">Editar</TableHead>
            <TableHead className="">Eliminar</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {data?.map((user: IUserEntityFront) => (
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
          ))}
        </TableBody>
      </Table>
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
    </div>
  );
};

export default UsersTable;
const DeleteUsersModal = React.lazy(
  () => import('../../../src/components/modals/DeleteUsersModal')
);
const UpdateUserModal = React.lazy(() => import('../../../src/components/modals/UpdateUserModal'));
