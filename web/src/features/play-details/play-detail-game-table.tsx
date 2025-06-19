import { FlexCol } from '@/components/flex';
import { Typography } from '@/components/typography';
import {
  Table,
  TableBody,
  TableHead,
  TableHeader,
  TableRow,
  TableCell,
} from '@/components/ui/table';
import { INewBetEntity } from '../../../../helper/request/bet.response';

const PlayDetailGameTable = ({bets}:{bets:INewBetEntity[]}) => {


  const NoPlaysFound = () => (
    <TableRow>
      <TableCell colSpan={6} className="text-center !py-[36px]">
        <FlexCol className="items-center justify-center gap-3">
          <Typography variant={'large'}>No se encontraron jugadas</Typography>
          <Typography variant={'small'} className={'font-light text-muted-foreground'}>
            Por favor cargue nuevas jugadas
          </Typography>
        </FlexCol>
      </TableCell>
    </TableRow>
  );

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Jugada</TableHead>
          <TableHead>Con</TableHead>
          <TableHead>Monto</TableHead>
          <TableHead>JugadaT</TableHead>
          <TableHead>Bloque</TableHead>
          <TableHead className="text-right">Jugada en</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>{bets.length === 0 ? <NoPlaysFound /> :bets.map(bet=>{
return(

  
  <TableRow>
        <TableCell>{bet.number}</TableCell>
        <TableCell>{bet.with}</TableCell>
        <TableCell>{bet.amount}</TableCell>
        <TableCell>{bet.bet_type}</TableCell>
        <TableCell>{bet.number}</TableCell>
        <TableCell className="text-right">{bet.lottery_id}</TableCell>
        </TableRow>
        )
      }
      ) 
        }</TableBody>
    </Table>
  );
};

export default PlayDetailGameTable;
