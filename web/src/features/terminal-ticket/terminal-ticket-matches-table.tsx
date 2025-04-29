import { Table, TableHeader, TableHead, TableRow, TableBody, TableCell } from '@/components/ui/table';


const TerminalTicketMatchesTable = () => {
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Jugada</TableHead>
          <TableHead>Monto</TableHead>
          <TableHead>Quiniela</TableHead>
          <TableHead>Tipo</TableHead>
          <TableHead>Turno</TableHead>
          <TableHead>Acierto</TableHead>
          <TableHead>Monto</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        <TableRow>
          <TableCell>1</TableCell>
          <TableCell>1</TableCell>
          <TableCell>1</TableCell>
          <TableCell>1</TableCell>
          <TableCell>1</TableCell>
          <TableCell>1</TableCell>
          <TableCell>1</TableCell>
        </TableRow><TableRow>
          <TableCell>1</TableCell>
          <TableCell>1</TableCell>
          <TableCell>1</TableCell>
          <TableCell>1</TableCell>
          <TableCell>1</TableCell>
          <TableCell>1</TableCell>
          <TableCell>1</TableCell>
        </TableRow>
      </TableBody>
    </Table>
  );
};

export default TerminalTicketMatchesTable;
