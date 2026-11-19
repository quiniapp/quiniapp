import dayjs from 'dayjs';
import { toast } from 'react-hot-toast';
import { Printer } from 'lucide-react';
import { IPollaGroupAccountEntityFront } from '@helper/polla/types/game.type';
import { useAuth } from '@/providers/AuthContext';
import { useGroupAccounts, useMyGroupAccounts } from '@/hooks/fetchs/usePollaData';
import { flattenPages } from '@/hooks/useApi';
import { EmptyState } from '@/components/PageHeader';
import { InfiniteList } from '@/components/InfiniteList';
import { Button } from '@/components/ui/button';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { printGroupLiquidationTicket } from '@/functions/current-account/groupLiquidationTicket';
import { fetchOrganizationName } from './fetchers';
import { fmtMoney } from './format';

/**
 * Historial de liquidaciones de grupos por fecha (solo lectura; se pueden
 * reimprimir). `mine`: el del grupo del admin.
 */
export const GroupAccountHistory = ({ mine = false }: { mine?: boolean }) => {
  const { organizationId } = useAuth();
  const all = useGroupAccounts({}, !mine);
  const own = useMyGroupAccounts(mine);
  const { data, fetchNextPage, hasNextPage, isFetchingNextPage, isFetching } = mine ? own : all;
  const { rows, totalCount } = flattenPages(data?.pages);

  const reprint = async (account: IPollaGroupAccountEntityFront) => {
    try {
      await printGroupLiquidationTicket({
        account,
        orgName: await fetchOrganizationName(organizationId),
      });
    } catch {
      toast.error('No se pudo imprimir el ticket');
    }
  };

  if (rows.length === 0) {
    return (
      <EmptyState message={isFetching ? 'Cargando…' : 'Todavía no hay liquidaciones de grupo'} />
    );
  }

  return (
    <InfiniteList
      totalCount={totalCount}
      loadedCount={rows.length}
      hasNextPage={Boolean(hasNextPage)}
      isFetchingNextPage={isFetchingNextPage}
      fetchNextPage={fetchNextPage}
    >
      <div className="overflow-x-auto rounded-md border bg-card text-card-foreground">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Grupo</TableHead>
              <TableHead>Período</TableHead>
              <TableHead className="text-right">Deja pasadores</TableHead>
              <TableHead className="text-right">Gastos</TableHead>
              <TableHead className="text-right">Base</TableHead>
              <TableHead className="text-right">% admin</TableHead>
              <TableHead className="text-right">Comisión</TableHead>
              <TableHead className="text-right">Arrastra</TableHead>
              <TableHead className="text-right">Pagado</TableHead>
              <TableHead className="text-right">Total admin</TableHead>
              <TableHead />
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((account) => (
              <TableRow key={account.polla_group_account_id}>
                <TableCell className="font-medium">{account.group_name}</TableCell>
                <TableCell className="whitespace-nowrap tabular-nums">
                  {dayjs(account.period_from).format('DD/MM')} al{' '}
                  {dayjs(account.date).format('DD/MM/YYYY')}
                </TableCell>
                <TableCell className="text-right tabular-nums">
                  ${fmtMoney(account.cashiers_subtotal)}
                </TableCell>
                <TableCell className="text-right tabular-nums">
                  ${fmtMoney(account.expenses)}
                </TableCell>
                <TableCell className="text-right tabular-nums">
                  ${fmtMoney(account.drag_base)}
                </TableCell>
                <TableCell className="text-right tabular-nums">
                  {Number(account.admin_percentage)}%
                </TableCell>
                <TableCell className="text-right tabular-nums">
                  ${fmtMoney(account.admin_commission)}
                </TableCell>
                <TableCell className="text-right tabular-nums">${fmtMoney(account.drag)}</TableCell>
                <TableCell className="text-right tabular-nums">${fmtMoney(account.paid)}</TableCell>
                <TableCell className="text-right font-semibold tabular-nums">
                  ${fmtMoney(account.total)}
                </TableCell>
                <TableCell>
                  <Button
                    type="button"
                    size="icon"
                    variant="ghost"
                    title="Imprimir"
                    aria-label={`Imprimir la liquidación de ${account.group_name}`}
                    onClick={() => reprint(account)}
                  >
                    <Printer />
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </InfiniteList>
  );
};
