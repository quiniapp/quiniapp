import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { EditIcon, TrashIcon } from 'lucide-react';

const mockUsers = [
  { numero: "0", nombre: "gabriel", grupo: "Grupo", comision: "20", debe: "10", conexion: "", cuenta: "Cuenta Corriente" },
  { numero: "11", nombre: "Mary(11)", grupo: "Grupo", comision: "20", debe: "10", conexion: "", cuenta: "Cuenta Corriente" },
  { numero: "15", nombre: "Norma(15)", grupo: "Grupo", comision: "20", debe: "10", conexion: "", cuenta: "Cuenta Corriente" }
];

const UsersTable = () => {
  return (
    <div className="border border-dark-lighter rounded-lg overflow-hidden w-full">
      <Table>
        <TableHeader className="bg-dark-light">
          <TableRow>
            <TableHead className="text-cyan">Numero</TableHead>
            <TableHead className="text-cyan">Nombre</TableHead>
            <TableHead className="text-cyan">Grupo</TableHead>
            <TableHead className="text-cyan">Comision</TableHead>
            <TableHead className="text-cyan">Debe</TableHead>
            <TableHead className="text-cyan">Conexion</TableHead>
            <TableHead className="text-cyan">Cuenta</TableHead>
            <TableHead className="text-cyan">Editar</TableHead>
            <TableHead className="flex justify-center">Eliminar</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {mockUsers.map((user) => (
            <TableRow key={user.numero} className="hover:bg-dark-lighter/50">
              <TableCell>{user.numero}</TableCell>
              <TableCell>{user.nombre}</TableCell>
              <TableCell>{user.grupo}</TableCell>
              <TableCell>{user.comision}</TableCell>
              <TableCell>{user.debe}</TableCell>
              <TableCell>{user.conexion}</TableCell>
              <TableCell>{user.cuenta}</TableCell>
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