import { Table, TableHeader, TableRow, TableHead, TableBody, TableCell } from '@/components/ui/table';

const TableTerminalTicket = () => {
  return (
    <div className={' overflow-y-scroll h-[300px] border mb-4'}>
      <Table>
        <TableHeader className={'bg-card-bg !px-4'}>
          <TableRow>
            <TableHead>Numero</TableHead>
            <TableHead>Pasador</TableHead>
            <TableHead>Monto</TableHead>
            <TableHead>Pagado</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          <TableRow>
            <TableCell>1</TableCell>
            <TableCell>1</TableCell>
            <TableCell>1</TableCell>
            <TableCell>1</TableCell>
          </TableRow><TableRow>
            <TableCell>1</TableCell>
            <TableCell>1</TableCell>
            <TableCell>1</TableCell>
            <TableCell>1</TableCell>
          </TableRow><TableRow>
            <TableCell>1</TableCell>
            <TableCell>1</TableCell>
            <TableCell>1</TableCell>
            <TableCell>1</TableCell>
          </TableRow><TableRow>
            <TableCell>1</TableCell>
            <TableCell>1</TableCell>
            <TableCell>1</TableCell>
            <TableCell>1</TableCell>
          </TableRow><TableRow>
            <TableCell>1</TableCell>
            <TableCell>1</TableCell>
            <TableCell>1</TableCell>
            <TableCell>1</TableCell>
          </TableRow><TableRow>
            <TableCell>1</TableCell>
            <TableCell>1</TableCell>
            <TableCell>1</TableCell>
            <TableCell>1</TableCell>
          </TableRow><TableRow>
            <TableCell>1</TableCell>
            <TableCell>1</TableCell>
            <TableCell>1</TableCell>
            <TableCell>1</TableCell>
          </TableRow><TableRow>
            <TableCell>1</TableCell>
            <TableCell>1</TableCell>
            <TableCell>1</TableCell>
            <TableCell>1</TableCell>
          </TableRow><TableRow>
            <TableCell>1</TableCell>
            <TableCell>1</TableCell>
            <TableCell>1</TableCell>
            <TableCell>1</TableCell>
          </TableRow><TableRow>
            <TableCell>1</TableCell>
            <TableCell>1</TableCell>
            <TableCell>1</TableCell>
            <TableCell>1</TableCell>
          </TableRow>

        </TableBody>
      </Table>
    </div>
      );
      };

      export default TableTerminalTicket;
