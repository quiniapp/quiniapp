import dayjs from 'dayjs';
import { useAuth } from '@/providers/AuthContext';
import { useOwnCreditMovements } from '@/hooks/fetchs/usePollaData';
import { flattenPages } from '@/hooks/useApi';
import { PageHeader } from '@/components/PageHeader';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import BetsPage from '../bets';

const fmtMoney = (value: number) =>
  new Intl.NumberFormat('es-AR', { minimumFractionDigits: 2 }).format(Number(value));

const MOVEMENT_LABEL: Record<string, string> = {
  LOAD: 'Carga',
  WITHDRAW: 'Retiro',
  BET: 'Jugada',
  BET_REFUND: 'Devolución',
  ADJUSTMENT: 'Ajuste',
};

/** Vista del jugador: sus jugadas con aciertos + su saldo de créditos. */
export const MyBetsPage = () => {
  const { user } = useAuth();
  const { data: movements } = useOwnCreditMovements();
  const { rows: movementsRows } = flattenPages(movements?.pages);

  return (
    <div className="flex flex-col gap-8">
      <BetsPage onlyMine />

      <section>
        <PageHeader
          title="Mis créditos"
          description={`Saldo actual: $${fmtMoney(user?.credit_balance ?? 0)}`}
        />

        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Fecha</TableHead>
                <TableHead>Movimiento</TableHead>
                <TableHead className="text-right">Monto</TableHead>
                <TableHead className="text-right">Saldo</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {movementsRows.map((movement) => (
                <TableRow key={movement.polla_credit_movement_id}>
                  <TableCell>{dayjs(movement.created_at).format('DD-MM-YYYY HH:mm')}</TableCell>
                  <TableCell>
                    {MOVEMENT_LABEL[movement.type] ?? movement.type}
                    {movement.reason ? ` · ${movement.reason}` : ''}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    ${fmtMoney(movement.amount)}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    ${fmtMoney(movement.balance_after)}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </section>
    </div>
  );
};

export default MyBetsPage;
