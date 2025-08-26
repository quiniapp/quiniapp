import { Table, TableHeader, TableHead, TableRow, TableBody, TableCell } from '@/components/ui/table';
import { Flex } from '@/components/flex';
import SkeletonList from '@/components/skeletons/skeleton-list';
import { IBetEntityFront } from '../../../../helper/types/bet.type';
interface TerminalTicketPlayTableProps {
  bets?: IBetEntityFront[];
}

const TerminalTicketPlayTable = ({ bets }: TerminalTicketPlayTableProps) => {
  const isLoading = bets === undefined || bets === null;
  return (
    <>
      {isLoading ? (
        <SkeletonList />
      ) : (
        <>
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
            <TableBody>
              {bets?.map((bet) => (
                <TableRow key={bet.bet_id}>
                  <TableCell>{bet.number}</TableCell>
                  <TableCell>${bet.amount}</TableCell>
                  <TableCell>{bet.lottery.name}</TableCell>
                  <TableCell>{bet.bet_type}</TableCell>
                  <TableCell>{bet.schedule.name}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          <Flex className="text-right items-end justify-end">Total Jugadas: {bets.length}</Flex>
        </>
      )}
    </>
  );
};

export default TerminalTicketPlayTable;
