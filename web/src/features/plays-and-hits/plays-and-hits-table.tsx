import {
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { useBets } from '@/hooks/fetchs/plays/useBets';
import { useSearchParams } from 'react-router-dom';
import { IBetEntityFront } from '../../../../helper/types/bet.type';
import { betPlaceDictionary } from '../../../../helper/functions/betPlaceDictionary';

const PlaysAndHitsTable = () => {
  const [setSearchParams] = useSearchParams();
  const { data } = useBets({
    schedule_id: setSearchParams.get('schedule_id'),
    date: setSearchParams.get('date'),
    cashier_id: setSearchParams.get('cashier_id'),
    lottery_id: setSearchParams.get('lottery_id'),
  });


  return (
    <Table>
      <TableCaption>No se encontraron jugadas</TableCaption>
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
        {data?.bets?.map((bet:IBetEntityFront) => {
          return(

          <TableRow>
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
          )
        })}
      </TableBody>
    </Table>
  );
};

export default PlaysAndHitsTable;
