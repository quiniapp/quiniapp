import {
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';

import { IBetEntityFront } from '@helper/types/bet.type';
import { betPlaceDictionary } from '@helper/functions/betPlaceDictionary';

const PlaysAndHitsTable = ({ bets = [] }: { bets?: IBetEntityFront[] }) => {
  return (
    <div className="flex-1 min-h-40 overflow-y-auto ">
      <div className="w-full overflow-x-auto 2xl:w-full">
        <Table className="table-fixed min-w-[1000px] w-[1000px] 2xl:w-full mx-auto">
          {/* 7 columnas de 100px + 2 de 150px = 1000px */}
          <colgroup>
            <col style={{ width: '100px' }} />
            <col style={{ width: '100px' }} />
            <col style={{ width: '100px' }} />
            <col style={{ width: '100px' }} />
            <col style={{ width: '100px' }} />
            <col style={{ width: '100px' }} />
            <col style={{ width: '100px' }} />
            <col style={{ width: '150px' }} />
            <col style={{ width: '150px' }} />
          </colgroup>

          <TableCaption className={!bets?.length ? '' : 'hidden'}>
            No se encontraron jugadas
          </TableCaption>

          <TableHeader>
            <TableRow className="bg-[#06081322] h-11">
              {/* Quitá las clases w-5/w-6 en TH/TD para no pelear con <colgroup> */}
              <TableHead className="px-3 whitespace-nowrap">Jugada</TableHead>
              <TableHead className="px-3 whitespace-nowrap">Monto</TableHead>
              <TableHead className="px-3 whitespace-nowrap">Tipo</TableHead>
              <TableHead className="px-3 whitespace-nowrap">Turno</TableHead>
              <TableHead className="px-3 whitespace-nowrap">Quiniela</TableHead>
              <TableHead className="px-3 whitespace-nowrap">Aciertos</TableHead>
              <TableHead className="px-3 whitespace-nowrap">MontoAciertos</TableHead>
              <TableHead className="px-3 whitespace-nowrap">Ticket</TableHead>
              <TableHead className="px-3 whitespace-nowrap">Usuario</TableHead>
            </TableRow>
          </TableHeader>

          <TableBody>
            {bets?.map((bet: IBetEntityFront, index: number) => (
              <TableRow key={index}>
                <TableCell className="px-3 whitespace-nowrap overflow-hidden text-ellipsis">
                  {bet.number}
                </TableCell>
                <TableCell className="px-3 whitespace-nowrap overflow-hidden text-ellipsis">
                  {bet.amount}
                </TableCell>
                <TableCell className="px-3 whitespace-nowrap overflow-hidden text-ellipsis">
                  {betPlaceDictionary[bet.place]}
                </TableCell>
                <TableCell className="px-3 whitespace-nowrap overflow-hidden text-ellipsis">
                  {bet.schedule.name}
                </TableCell>
                <TableCell className="px-3 whitespace-nowrap overflow-hidden text-ellipsis">
                  {bet.lottery.name}
                </TableCell>
                <TableCell className="px-3 whitespace-nowrap overflow-hidden text-ellipsis">
                  {bet.hits}
                </TableCell>
                <TableCell className="px-3 whitespace-nowrap overflow-hidden text-ellipsis">
                  ${bet.prize}
                </TableCell>
                <TableCell className="px-3 whitespace-nowrap overflow-hidden text-ellipsis">
                  {bet.ticket_number}
                </TableCell>
                <TableCell className="px-3 whitespace-nowrap overflow-hidden text-ellipsis">
                  {bet.cashier_name}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
};

export default PlaysAndHitsTable;
