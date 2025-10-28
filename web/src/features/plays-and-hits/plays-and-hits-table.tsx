import {
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

import { IBetEntityFront } from '@helper/types/bet.type';
import { betPlaceDictionary } from '@helper/functions/betPlaceDictionary';
import { Flex } from '@/components/flex';

type Props = { bets?: IBetEntityFront[] };

const currency = (n?: number | string) =>
  typeof n === 'number'
    ? n.toLocaleString('es-AR', { style: 'currency', currency: 'ARS', maximumFractionDigits: 0 })
    : (n ?? '');

const cut = (s?: string, len = 10) => (s && s.length > len ? `${s.slice(0, len)}…` : (s ?? ''));

const PlaysAndHitsTable: React.FC<Props> = ({ bets = [] }) => {
  return (
    <div className="flex-1 min-h-40 overflow-y-auto">
      {/* ====== DESKTOP/TABLET: tabla (>= sm) ====== */}
      <div className="hidden sm:block w-full overflow-x-auto 2xl:w-full">
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
                  {currency(bet.amount)}
                </TableCell>
                <TableCell className="px-3 whitespace-nowrap overflow-hidden text-ellipsis">
                  {betPlaceDictionary[bet.place]}
                </TableCell>
                <TableCell className="px-3 whitespace-nowrap overflow-hidden text-ellipsis">
                  {bet.schedule?.name}
                </TableCell>
                <TableCell className="px-3 whitespace-nowrap overflow-hidden text-ellipsis">
                  {bet.lottery?.name}
                </TableCell>
                <TableCell className="px-3 whitespace-nowrap overflow-hidden text-ellipsis">
                  {bet.hits}
                </TableCell>
                <TableCell className="px-3 whitespace-nowrap overflow-hidden text-ellipsis">
                  {currency(bet.prize)}
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
