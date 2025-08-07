import {
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';

import { IBetEntityFront } from '../../../../helper/types/bet.type';
import { betPlaceDictionary } from '../../../../helper/functions/betPlaceDictionary';

const PlaysAndHitsTable = ({ bets = [] }: { bets?: IBetEntityFront[] }) => {
  return (
    <div className="flex-1 overflow-y-auto min-h-40">
      <Table className="py-1 md:py-3">
        {!bets?.length && <TableCaption>No se encontraron jugadas</TableCaption>}
        <TableHeader>
          <TableRow className={'bg-[#06081322] px-6 h-[56px]'}>
            <TableHead className="w-[100px]">Jugada</TableHead>
            <TableHead>Monto</TableHead>
            <TableHead>Tipo</TableHead>
            <TableHead>Turno</TableHead>
            <TableHead>Quiniela</TableHead>
            <TableHead>Aciertos</TableHead>
            <TableHead>MontoAciertos</TableHead>
            <TableHead>Ticket</TableHead>
            <TableHead>Usuario</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {bets?.map((bet: IBetEntityFront, index) => {
            return (
              <TableRow key={index}>
                <TableCell className="font-medium">{bet.number}</TableCell>
                <TableCell>{bet.amount}</TableCell>
                <TableCell>{betPlaceDictionary[bet.place]}</TableCell>
                <TableCell>{bet.schedule.name}</TableCell>
                <TableCell>{bet.lottery.name}</TableCell>
                <TableCell>{bet.winner}</TableCell>
                <TableCell>${bet.prize}</TableCell>
                <TableCell>{bet.ticket_number}</TableCell>
                <TableCell>{bet.cashier_name}</TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
};

export default PlaysAndHitsTable;
