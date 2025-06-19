import {
  Table,
  TableHeader,
  TableRow,
  TableHead,
  TableBody,
  TableCell,
} from '@/components/ui/table';

interface TableTerminalTicketProps {
  data: any[];
  onTicketClick?: (ticket: any) => void;
}
const TableTerminalTicket = ({ data, onTicketClick }: TableTerminalTicketProps) => {
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
            {data?.map((item:any) => (
              <TableRow
                key={item.ticket_id}
                className="cursor-pointer hover:bg-primary-light transition"
                onClick={() => onTicketClick?.(item)}
              >
                <TableCell>{item.ticket_number}</TableCell>
                <TableCell>{item.user_name}</TableCell>
                <TableCell>${item.total}</TableCell>
                <TableCell className={'text-right'}>
                  {item.paid ? 'Pagado' : 'No pagado'}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
};

export default TableTerminalTicket;
