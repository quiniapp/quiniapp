import {
  Table,
  TableHeader,
  TableRow,
  TableHead,
  TableBody,
  TableCell,
} from '@/components/ui/table';

const TableTerminalTicket = () => {
  return (
    <div className="border mb-4">
      <Table className="min-w-full table-fixed">
        <TableHeader>
          <TableRow className="bg-card-bg sticky top-0 z-10">
            <TableHead className="bg-card-bg text-white">Numero</TableHead>
            <TableHead className="bg-card-bg text-white">Pasador</TableHead>
            <TableHead className="bg-card-bg text-white">Monto</TableHead>
            <TableHead className="bg-card-bg text-white text-right ">Pagado</TableHead>
          </TableRow>
        </TableHeader>
      </Table>
      <div className="overflow-y-auto h-[200px] 1440:h-[300px]">
        <Table className="min-w-full table-fixed">
          <TableBody>
            {Array.from({ length: 20 }).map((_, idx) => (
              <TableRow key={idx}>
                <TableCell>{idx + 1}</TableCell>
                <TableCell>Pasador {idx + 1}</TableCell>
                <TableCell>${(idx + 1) * 100}</TableCell>
                <TableCell className={'text-right'}>Pagado</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
};

export default TableTerminalTicket;
