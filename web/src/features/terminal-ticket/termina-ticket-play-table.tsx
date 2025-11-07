import {
  Table,
  TableHeader,
  TableHead,
  TableRow,
  TableBody,
  TableCell,
} from '@/components/ui/table';
import SkeletonList from '@/components/skeletons/skeleton-list';
import { IBetEntityFront } from '@helper/types/bet.type';
interface TerminalTicketPlayTableProps {
  bets?: IBetEntityFront[];
  isLoading?: boolean;
  /** opcional: alto máximo del body */
  maxBodyHeightClass?: string; // ej "max-h-[60vh]"
}

const TerminalTicketPlayTable = ({
  bets,
  isLoading,
  maxBodyHeightClass = 'max-h-[50vh]', // ajustá a tu layout
}: TerminalTicketPlayTableProps) => {
  if (isLoading) return <SkeletonList />;

  return (
    <div className="flex-1 min-h-40">
      <div className={` rounded-md border`}>
        <Table className="table-fixed">
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
        <div className={`overflow-y-auto ${maxBodyHeightClass}`}>
          <Table className="table-fixed ">
            <TableBody>
              {bets?.map((bet) => (
                <TableRow key={bet.bet_id}>
                  <TableCell className="truncate">{bet.number}</TableCell>
                  <TableCell className="whitespace-nowrap">${bet.amount}</TableCell>
                  <TableCell className="truncate">{bet.lottery.name}</TableCell>
                  <TableCell className="truncate">{bet.bet_type}</TableCell>
                  <TableCell className="truncate">{bet.schedule.name}</TableCell>
                </TableRow>
              ))}

            </TableBody>
          </Table>
        </div>
      </div>
    </div>
  );
};

export default TerminalTicketPlayTable;
