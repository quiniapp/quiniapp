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
import { Users } from '@/types/user.type.ts';
import SkeletonList from '@/components/skeletons/skeleton-list.tsx';
import { useDeleteUsers } from '@/hooks/mutations/users/useDeleteUser';
import { toast } from 'react-hot-toast';
import React, { Suspense, useState } from 'react';
import { IUserEntityFront } from '../../../../helper/types/user.type';

const UsersTable = () => {
  const [open, setOpen] = useState<boolean>(false);
  const { data, isLoading, error } = useUsers();
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
          {data?.data?.users?.map((user: IUserEntityFront) => (
            <TableRow key={user.number} className="hover:bg-dark-lighter/50">
              <TableCell>{user.number}</TableCell>
              <TableCell>{user.name}</TableCell>
              <TableCell>{user.group_id}</TableCell>
              <TableCell>{user.fee!}</TableCell>
              <TableCell>{user.fee_plus!}</TableCell>
              <TableCell>{user.address}</TableCell>
              <TableCell>{user.account!}</TableCell>
              <TableCell>
                <Button variant="ghost" className="hover:text-cyan" size={'icon'}>
                  <EditIcon />
                </Button>
              </TableCell>
              <TableCell className={'flex justify-center items-center'}>
                <Button
                  variant="ghost"
                  className="hover:text-destructive"
                  size={'icon'}
                  onClick={() => setOpen(true)}
                >
                  <TrashIcon />
                </Button>
              </TableCell>
              <Suspense fallback={<div>Cargando...</div>}>
                <DeleteUsersModal
                  isOpen={open}
                  onClose={() => setOpen(false)}
                  onClick={handleDeleteUser}
                  isPending={isPending}
                  user={user}
                />
              </Suspense>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
};

export default UsersTable;
const DeleteUsersModal = React.lazy(
  () => import('../../../src/components/modals/DeleteUsersModal')
);
