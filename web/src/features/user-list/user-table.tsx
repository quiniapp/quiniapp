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
import { useEffect } from 'react';
import { useUsers } from '@/hooks/useUsers.ts';
import { Users } from '@/types/user.type.ts';



const UsersTable = () => {

  const { data, isLoading, error } = useUsers();

  useEffect(() => {
    if (data) {
      console.log('Usuarios del backend:', data?.data);
    }
  }, [data]);

  if (isLoading) return <div>Cargando...</div>;
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
          {data?.data?.users?.map((user: Users) => (
            <TableRow key={user.number} className="hover:bg-dark-lighter/50">
              <TableCell>{user.number}</TableCell>
              <TableCell>{user.name}</TableCell>
              <TableCell>{user.group_id}</TableCell>
              <TableCell>{user.fee}</TableCell>
              <TableCell>{user.fee_plus}</TableCell>
              <TableCell>{user.address
              }</TableCell>
              <TableCell>{user.account}</TableCell>
              <TableCell>
                <Button variant="ghost" className="hover:text-cyan" size={'icon'}>
                  <EditIcon />
                </Button>
              </TableCell>
              <TableCell className={'flex justify-center items-center'}>
                <Button variant="ghost" className="hover:text-destructive" size={'icon'}>
                  <TrashIcon />
                </Button>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
};

export default UsersTable;
