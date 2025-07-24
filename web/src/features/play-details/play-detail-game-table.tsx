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
import { betPlaceDictionary } from '../../../../helper/functions/betPlaceDictionary';

const PlayDetailGameTable = ({ bets }: { bets: INewBetEntity[] }) => {
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
<div>

  <Table className="min-w-full table-fixed">
      <TableHeader>
        <TableRow>
          <TableHead>Jugada</TableHead>
          <TableHead>Con</TableHead>
          <TableHead>Monto</TableHead>
          <TableHead>JugadaT</TableHead>
          <TableHead>Jugada en</TableHead>
          <TableHead className="text-right">Turno</TableHead>
        </TableRow>
      </TableHeader>
    </Table>
      <div className="overflow-y-auto ">
        <Table className="min-w-full table-fixed">
          <TableBody>
            {bets.length === 0 ? (
              <NoPlaysFound />
            ) : (
              bets.map((bet, index) => {
                return (
                  <TableRow key={index}>
                    <TableCell>{bet.number}</TableCell>
                    <TableCell>{bet.with}</TableCell>
                    <TableCell>{bet.amount}</TableCell>
                    <TableCell>{`${betPlaceDictionary[bet.place]} ${bet?.position ? betPlaceDictionary[bet.position] : ''}`}</TableCell>
                    <TableCell>{bet.lotteries.name}</TableCell>
                    <TableCell className="text-right">{bet.schedules.name}</TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </div>
</div>

);
};

export default PlayDetailGameTable;
