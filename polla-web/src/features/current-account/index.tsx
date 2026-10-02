import { useState } from 'react';
import dayjs from 'dayjs';
import { POLLA_USER_TYPE, isPollaAdminRole } from '@helper/polla/types/user.type';
import { useAuth } from '@/providers/AuthContext';
import { useCurrentAccounts } from '@/hooks/fetchs/usePollaData';
import { useGroups } from '@/hooks/fetchs/useCatalogs';
import {
  useCalculateCurrentAccounts,
  useLiquidateCurrentAccounts,
} from '@/hooks/mutations/usePollaMutations';
import { EmptyState, PageHeader } from '@/components/PageHeader';
import { InfiniteList } from '@/components/InfiniteList';
import { flattenPages } from '@/hooks/useApi';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';

const fmtMoney = (value: number) =>
  new Intl.NumberFormat('es-AR', { minimumFractionDigits: 2 }).format(Number(value));

export const CurrentAccountPage = () => {
  const { role, organizationId } = useAuth();
  const canManage = Boolean(role && isPollaAdminRole(role));

  const [date, setDate] = useState(dayjs().format('YYYY-MM-DD'));
  const [groupId, setGroupId] = useState('');

  const { data, fetchNextPage, hasNextPage, isFetchingNextPage } = useCurrentAccounts({
    date,
    polla_group_id: groupId || undefined,
    polla_organization_id: organizationId ?? undefined,
  });

  const { rows, totalCount } = flattenPages(data?.pages);

  const { data: groups } = useGroups({ polla_organization_id: organizationId ?? undefined });
  const { mutate: calculate, isPending: isCalculating } = useCalculateCurrentAccounts();
  const { mutate: liquidate, isPending: isLiquidating } = useLiquidateCurrentAccounts();

  const body = {
    date,
    ...(organizationId ? { polla_organization_id: organizationId } : {}),
  };

  const totals = rows.reduce(
    (acc, row) => ({
      pass: acc.pass + Number(row.pass),
      successes: acc.successes + Number(row.successes),
      commission: acc.commission + Number(row.cashier_commission),
      total: acc.total + Number(row.total),
    }),
    { pass: 0, successes: 0, commission: 0, total: 0 }
  );

  return (
    <div>
      <PageHeader
        description="Pases, premios, comisión y arrastre por pasador y por día."
        actions={
          canManage && (
            <div className="flex gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => calculate(body)}
                disabled={isCalculating}
              >
                {isCalculating ? 'Recalculando…' : 'Recalcular'}
              </Button>
              <Button
                type="button"
                onClick={() => liquidate({ ...body, leave: true })}
                disabled={isLiquidating}
              >
                {isLiquidating ? 'Liquidando…' : 'Liquidar día'}
              </Button>
            </div>
          )
        }
      />

      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-end">
        <div className="flex min-w-0 flex-col gap-1">
          <Label>Fecha</Label>
          <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
        </div>

        {role !== POLLA_USER_TYPE.CASHIER && (
          <div className="flex min-w-0 flex-col gap-1">
            <Label>Grupo</Label>
            <Select
              value={groupId || 'all'}
              onValueChange={(v) => setGroupId(v === 'all' ? '' : v)}
            >
              <SelectTrigger className="w-full sm:w-[200px]">
                <SelectValue placeholder="Todos" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos</SelectItem>
                {groups?.data.map((group) => (
                  <SelectItem key={group.polla_group_id} value={group.polla_group_id}>
                    {group.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}
      </div>

      {rows.length === 0 ? (
        <EmptyState message="No hay movimientos para esa fecha" />
      ) : (
        <InfiniteList
          totalCount={totalCount}
          loadedCount={rows.length}
          hasNextPage={Boolean(hasNextPage)}
          isFetchingNextPage={isFetchingNextPage}
          fetchNextPage={fetchNextPage}
        >
          <div className="overflow-x-auto rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Pasador</TableHead>
                  <TableHead className="text-right">Pase</TableHead>
                  <TableHead className="text-right">Premios</TableHead>
                  <TableHead className="text-right">Comisión</TableHead>
                  <TableHead className="text-right">Subtotal</TableHead>
                  <TableHead className="text-right">Saldo anterior</TableHead>
                  <TableHead className="text-right">Arrastre</TableHead>
                  <TableHead className="text-right">Recargo</TableHead>
                  <TableHead className="text-right">Total</TableHead>
                  <TableHead>Estado</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((row) => (
                  <TableRow key={row.polla_current_account_id}>
                    <TableCell>
                      {row.user_number ? `${row.user_number} · ` : ''}
                      {row.user_name}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">${fmtMoney(row.pass)}</TableCell>
                    <TableCell className="text-right tabular-nums">
                      ${fmtMoney(row.successes)}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      ${fmtMoney(row.cashier_commission)}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      ${fmtMoney(row.subtotal)}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      ${fmtMoney(row.previous_balance)}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">${fmtMoney(row.drag)}</TableCell>
                    <TableCell className="text-right tabular-nums">
                      ${fmtMoney(row.leave)}
                    </TableCell>
                    <TableCell className="text-right font-semibold tabular-nums">
                      ${fmtMoney(row.total)}
                    </TableCell>
                    <TableCell>
                      {row.is_liquidated ? (
                        <Badge className="bg-emerald-600">Liquidado</Badge>
                      ) : (
                        <Badge variant="outline">Abierto</Badge>
                      )}
                    </TableCell>
                  </TableRow>
                ))}

                {rows.length > 0 && (
                  <TableRow className="font-semibold">
                    <TableCell>Totales de la página</TableCell>
                    <TableCell className="text-right tabular-nums">
                      ${fmtMoney(totals.pass)}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      ${fmtMoney(totals.successes)}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      ${fmtMoney(totals.commission)}
                    </TableCell>
                    <TableCell colSpan={4} />
                    <TableCell className="text-right tabular-nums">
                      ${fmtMoney(totals.total)}
                    </TableCell>
                    <TableCell />
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </InfiniteList>
      )}
    </div>
  );
};

export default CurrentAccountPage;
