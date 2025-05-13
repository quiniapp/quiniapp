import { Table, TableHeader, TableHead, TableRow, TableBody, TableCell } from '@/components/ui/table';


const TerminalTicketMatchesTable = () => {
  return (<div className="border mb-4">
    <Table className="min-w-full table-fixed">
      <TableHeader>
        <TableRow className={'bg-card-bg'}>
          <TableHead>Jugada</TableHead>
          <TableHead>Monto</TableHead>
          <TableHead>Quiniela</TableHead>
          <TableHead>Tipo</TableHead>
          <TableHead>Turno</TableHead>
          <TableHead>Acierto</TableHead>
          <TableHead>Monto</TableHead>
        </TableRow>
      </TableHeader>
    </Table>
      <div className="overflow-y-auto h-[120px] 1440:h-[300px]">
        <Table className="min-w-full table-fixed">
        <TableBody>
          {Array.from({ length: 20 }).map((_, idx) => (
            <TableRow key={idx} className={''}>
              <TableCell>1</TableCell>
              <TableCell>1</TableCell>
              <TableCell>1</TableCell>
              <TableCell>1</TableCell>
              <TableCell>1</TableCell>
              <TableCell>1</TableCell>
              <TableCell>1</TableCell>
            </TableRow>
          ))}
        </TableBody>
        </Table>
      </div>
  </div>
);
};

export default TerminalTicketMatchesTable;
