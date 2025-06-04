import { Table, TableHeader, TableHead, TableRow } from '@/components/ui/table';

const TerminalTicketPlayTable = () => {
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Jugada</TableHead>
          <TableHead>Monto</TableHead>
          <TableHead>Quiniela</TableHead>
          <TableHead>Tipo</TableHead>
          <TableHead>Turno</TableHead>
        </TableRow>
      </TableHeader>
    </Table>
  );
};

export default TerminalTicketPlayTable;
