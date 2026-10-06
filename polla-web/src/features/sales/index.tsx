import { useState } from 'react';
import dayjs from 'dayjs';
import { POLLA_USER_TYPE } from '@helper/polla/types/user.type';
import { useAuth } from '@/providers/AuthContext';
import { useDailySales } from '@/hooks/fetchs/usePollaData';
import { EmptyState, PageHeader } from '@/components/PageHeader';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Table,
  TableBody,
  TableCell,
  TableFooter,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';

const fmtMoney = (value: number) =>
  new Intl.NumberFormat('es-AR', { minimumFractionDigits: 2 }).format(Number(value));

/**
 * Boletas vendidas en el día. Superadmin y admin ven el total del capitalista y
 * el desglose por grupo; el pasador, lo suyo y lo de sus jugadores.
 */
export const SalesPage = () => {
  const { role, organizationId } = useAuth();
  const [date, setDate] = useState(dayjs().format('YYYY-MM-DD'));

  const isCashier = role === POLLA_USER_TYPE.CASHIER;
  const { data: sales, isFetching } = useDailySales({
    date,
    polla_organization_id: organizationId,
  });

  return (
    <div>
      <PageHeader
        description={
          isCashier
            ? 'Boletas que vendiste en el día, sumando las de tus jugadores.'
            : 'Boletas vendidas en el día, en total y por grupo.'
        }
      />

      <div className="mb-4 flex flex-col gap-1 sm:w-[200px]">
        <Label htmlFor="sales-date">Fecha</Label>
        <Input
          id="sales-date"
          type="date"
          value={date}
          max={dayjs().format('YYYY-MM-DD')}
          onChange={(e) => e.target.value && setDate(e.target.value)}
        />
      </div>

      <div className="mb-6 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:max-w-2xl">
        <div className="rounded-xl border bg-card p-4 text-card-foreground">
          <p className="text-sm text-muted-foreground">Boletas vendidas</p>
          <p className="text-3xl font-bold tabular-nums">{sales?.bets_count ?? 0}</p>
        </div>
        <div className="rounded-xl border bg-card p-4 text-card-foreground">
          <p className="text-sm text-muted-foreground">Recaudado</p>
          <p className="text-3xl font-bold tabular-nums">${fmtMoney(sales?.amount ?? 0)}</p>
        </div>
      </div>

      {sales?.groups &&
        (sales.groups.length === 0 ? (
          <EmptyState message={isFetching ? 'Cargando…' : 'No hubo ventas ese día'} />
        ) : (
          <div className="overflow-x-auto rounded-md border bg-card text-card-foreground lg:max-w-2xl">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Grupo</TableHead>
                  <TableHead className="text-right">Boletas</TableHead>
                  <TableHead className="text-right">Recaudado</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {sales.groups.map((group) => (
                  <TableRow key={group.polla_group_id ?? 'none'}>
                    <TableCell>{group.group_name ?? 'Sin grupo'}</TableCell>
                    <TableCell className="text-right tabular-nums">{group.bets_count}</TableCell>
                    <TableCell className="text-right tabular-nums">
                      ${fmtMoney(group.amount)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
              <TableFooter>
                <TableRow className="font-semibold">
                  <TableCell>Total</TableCell>
                  <TableCell className="text-right tabular-nums">{sales.bets_count}</TableCell>
                  <TableCell className="text-right tabular-nums">
                    ${fmtMoney(sales.amount)}
                  </TableCell>
                </TableRow>
              </TableFooter>
            </Table>
          </div>
        ))}
    </div>
  );
};

export default SalesPage;
