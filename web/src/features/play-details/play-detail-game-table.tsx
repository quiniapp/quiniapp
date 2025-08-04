import { Flex, FlexCol } from '@/components/flex';
import { Typography } from '@/components/typography';
import {
  Table,
  TableBody,
  TableHead,
  TableHeader,
  TableRow,
  TableCell,
} from '@/components/ui/table';
import { betPlaceDictionary } from '../../../../helper/functions/betPlaceDictionary';
import { IBetTable } from '.';

const PlayDetailGameTable = ({ bets }: { bets: IBetTable[] }) => {
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
    <div className="flex-1 overflow-y-auto">
      <Table className=" ">
        <TableHeader>
          <TableRow>
            <TableHead>Jugada</TableHead>
            <TableHead>Con</TableHead>
            <TableHead>Monto</TableHead>
            <TableHead>JugadaT</TableHead>
            <TableHead>Jugada en/Turno</TableHead>
          </TableRow>
        </TableHeader>

        <TableBody>
          {bets.length === 0 ? (
            <NoPlaysFound />
          ) : (
            bets.map((bet, index) => {
              return (
                <TableRow key={index} className="">
                  <TableCell>{bet.number}</TableCell>
                  <TableCell>{bet.with}</TableCell>
                  <TableCell>{bet.amount}</TableCell>
                  <TableCell className="whitespace-normal break-words">{`${betPlaceDictionary[bet.place]} ${bet?.position ? betPlaceDictionary[bet.position] : ''}`}</TableCell>
                  <TableCell>
                    <span>
                      {bet.scheduleLottery
                        .map((lotSched) => {
                          return `${lotSched.lotteries.name}-${lotSched.schedules.name}`;
                        })
                        .join(' / ')}
                    </span>
                  </TableCell>
                </TableRow>
              );
            })
          )}
        </TableBody>
      </Table>
    </div>
  );
};

export default PlayDetailGameTable;
