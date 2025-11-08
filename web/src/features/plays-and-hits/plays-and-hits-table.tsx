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

type Props = { bets?: IBetEntityFront[] };

const currency = (n?: number | string) =>
  typeof n === 'number'
    ? n.toLocaleString('es-AR', { style: 'currency', currency: 'ARS', maximumFractionDigits: 0 })
    : (n ?? '');

const PlaysAndHitsTable: React.FC<Props> = ({ bets = [] }) => {
  return (
    <div className="flex-1 min-h-40 overflow-y-auto">
      {/* ====== DESKTOP/TABLET: tabla (>= sm) ====== */}
      <div className="hidden sm:block w-[1000px] overflow-x-auto xl:w-[1200px] 2xl:w-[1500px]">
        <Table className="table-fixed min-w-[1000px] w-[1000px]  xl:w-[1200px] 2xl:w-[1450px] mx-auto">
         

          <TableCaption className={!bets?.length ? '' : 'hidden'}>
            No se encontraron jugadas
          </TableCaption>

          <TableHeader>
            <TableRow className="bg-[#06081322] h-11">
              <TableHead className="px-2 whitespace-nowrap text-base">Jugada</TableHead>
              <TableHead className="px-2 whitespace-nowrap text-base">Monto</TableHead>
              <TableHead className="px-2 whitespace-nowrap text-base">Tipo</TableHead>
              <TableHead className="px-2 whitespace-nowra text-base">Turno</TableHead>
              <TableHead className="px-2 whitespace-nowrap text-base">Quiniela</TableHead>
              <TableHead className="px-2 whitespace-nowrap text-base">Aciertos</TableHead>
              <TableHead className="px-2 whitespace-nowrap text-base">$ Aciertos</TableHead>
              <TableHead className="px-2 whitespace-nowrap text-base">Ticket</TableHead>
              <TableHead className="px-2 whitespace-nowrap text-base">Usuario</TableHead>
            </TableRow>
          </TableHeader>

          <TableBody>
            {bets?.map((bet: IBetEntityFront, index: number) => (
              <TableRow key={index}>
                <TableCell className="px-2 whitespace-nowrap overflow-hidden text-ellipsis  text-lg">
                  {bet.number}
                </TableCell>
                <TableCell className="px-2 whitespace-nowrap overflow-hidden text-ellipsis text-lg">
                  {currency(bet.amount)}
                </TableCell>
                <TableCell className="px-2 whitespace-nowrap overflow-hidden text-ellipsis text-lg">
                  {betPlaceDictionary[bet.place]}
                </TableCell>
                <TableCell className="px-2 whitespace-nowrap overflow-hidden text-ellipsis text-lg">
                  {bet.schedule?.name}
                </TableCell>
                <TableCell className="px-2 whitespace-nowrap overflow-hidden text-ellipsis text-lg">
                  {bet.lottery?.name}
                </TableCell>
                <TableCell className="px-2 whitespace-nowrap overflow-hidden text-ellipsis text-lg">
                  {bet.hits}
                </TableCell>
                <TableCell className="px-2 whitespace-nowrap overflow-hidden text-ellipsis text-lg">
                  {currency(bet.prize)}
                </TableCell>
                <TableCell className="px-2 whitespace-nowrap overflow-hidden text-ellipsis text-lg">
                  {bet.ticket_number}
                </TableCell>
                <TableCell className="px-2 whitespace-nowrap overflow-hidden text-ellipsis text-lg">
                  {bet.cashier_name}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      {/* ====== MOBILE: cards (< sm) ====== */}
      {/* ====== MOBILE: cards (< sm) ====== */}
      <div className="sm:hidden space-y-2 p-2">
        {(!bets || bets.length === 0) && (
          <p className="text-center text-sm text-muted-foreground">No se encontraron jugadas</p>
        )}

        {bets?.map((bet, i) => (
          <div
            key={i}
            className="rounded-xl border border-white/10 bg-[#0d1124] p-3 text-white shadow-sm"
          >
            {/* GRID principal: 3 columnas fijas y una fila final para ticket */}
            <div className="grid grid-cols-3 gap-x-4 gap-y-2 max-[350px]:grid-cols-2">
              <Field label="Jugada" value={bet.number} />
              <Field label="Monto" value={`$${bet.amount}`} />
              <Field label="Tipo" value={betPlaceDictionary[bet.place]} />

              <Field label="Turno" value={bet.schedule?.name} />
              <Field label="Quiniela" value={bet.lottery?.name} />
              <Field label="Aciertos" value={String(bet.hits ?? 0)} />

              <Field label="MontoAciertos" value={`$${bet.prize}`} />
              {/* última fila: ticket ocupa todo el ancho */}
              <Field label="Ticket" value={bet.ticket_number} full />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

/** Subcomponente para fila label → valor */
const Field: React.FC<{
  label: string;
  value?: string;
  full?: boolean;
}> = ({ label, value = '-', full }) => {
  return (
    <div className={`flex flex-col ${full ? 'col-span-3 max-[350px]:col-span-2' : ''}`}>
      <span className="text-[11px] font-medium text-blue-200/80 uppercase tracking-wide">
        {label}
      </span>
      <span className="text-sm font-semibold text-white truncate">{value}</span>
    </div>
  );
};

export default PlaysAndHitsTable;
