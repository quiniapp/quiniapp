import {
  Table,
  TableHeader,
  TableRow,
  TableHead,
  TableBody,
  TableCell,
} from '@/components/ui/table';
import { cn } from '@/lib/utils';
import { useSearchParams } from 'react-router-dom';
import { ITicketEntityFront } from '@helper/types/ticket.type';

interface TableTerminalTicketProps {
  data?: ITicketEntityFront[];
}
const TableTerminalTicket = ({ data }: TableTerminalTicketProps) => {
  const [searchParams, setSearchParams] = useSearchParams();
  const selected = searchParams.get('ticket_number');

  const handleClick = (ticket_number: string) => {
    if (selected === ticket_number) {
      searchParams.delete('ticket_number');
      setSearchParams(searchParams);
    } else {
      const params = new URLSearchParams(searchParams);
      params.set('ticket_number', ticket_number);
      setSearchParams(params);
    }
  };

  return (
    <div className="border mb-1 sm:mb-4">
      <Table className="min-w-full table-fixed">
        <TableHeader>
          <TableRow className="bg-card-bg sticky top-0 z-10">
            <TableHead className="bg-card-bg text-white">Número</TableHead>
            <TableHead className="bg-card-bg text-white">Pasador</TableHead>
            <TableHead className="bg-card-bg text-white">Monto</TableHead>
            {/* ⬇️ Se oculta en <sm */}
            <TableHead className="hidden sm:table-cell bg-card-bg text-white text-right">
              Pagado
            </TableHead>
          </TableRow>
        </TableHeader>
      </Table>

      <div className="overflow-y-auto h-[200px] 1440:h-[300px]">
        <Table className="min-w-full table-fixed">
          <TableBody>
            {data?.map((item: ITicketEntityFront) => (
              <TableRow
                key={item.ticket_id}
                data-state={selected === item.ticket_number ? 'selected' : undefined}
                className={cn(
                  `cursor-pointer hover:bg-primary-light transition ${
                    selected === item.ticket_number ? 'bg-primary-light' : ''
                  }`
                )}
                onClick={() => handleClick(item.ticket_number)}
              >
                <TableCell>{item.ticket_number}</TableCell>
                <TableCell>{item.user_name}</TableCell>
                <TableCell>${item.total}</TableCell>
                {/* ⬇️ También se oculta en <sm */}
                <TableCell className="hidden sm:table-cell text-right">
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
