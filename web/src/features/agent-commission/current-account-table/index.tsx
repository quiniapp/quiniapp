import Box from '@/components/box';
import { FlexCol } from '@/components/flex';
import { Typography } from '@/components/typography';
import {
  Table,
  TableBody,
  TableCell,
  TableFooter,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import SkeletonList from '@/components/skeletons/skeleton-list';
import { Button } from '@/components/ui/button';
import { ICurrentAccountEntityFront } from '../../../../../helper/types/current_account.type';
import React, { Suspense, useMemo, useState } from 'react';


interface CurrentAccountTableProps {
  data: ICurrentAccountEntityFront[];
  isLoading: boolean;
  isPending: boolean;
}

const CurrentAccountTable = ({ data, isLoading, isPending }: CurrentAccountTableProps) => {
  const [isOpen, setIsOpen] = useState<boolean>(false);
  const [currentAccount, setCurrentAccount] = useState<ICurrentAccountEntityFront | undefined>(
    undefined
  );
  const totals = useMemo(() => {
    return data?.reduce(
      (currAcc, item) => {
        currAcc.pass += item.pass || 0;
        currAcc.successes += item.successes || 0;
        currAcc.claims += item.claims || 0;
        currAcc.subtotal += item.subtotal || 0;
        currAcc.previous_balance += item.previous_balance || 0;
        currAcc.collections += item.collections || 0;
        currAcc.paid += item.paid || 0;
        currAcc.total += item.total || 0;
        currAcc.drag += item.drag || 0;
        currAcc.leave += item.leave || 0;
        return currAcc;
      },
      {
        pass: 0,
        successes: 0,
        claims: 0,
        subtotal: 0,
        previous_balance: 0,
        collections: 0,
        paid: 0,
        total: 0,
        drag: 0,
        leave: 0,
      }
    );
  }, [data]);

  const handleClick = (currentAccount: ICurrentAccountEntityFront) => {
    setIsOpen(true);
    setCurrentAccount(currentAccount);
  };

  return (
    <Box className="p-1 sm:p-3">
      <Table className="overflow-hidden rounded-[16px_16px_0_0]">
        <TableHeader className="border overflow-hidden rounded-[16px_16px_0_0]">
          <TableRow>
            <TableHead> Liquidar </TableHead>
            <TableHead> Numero </TableHead>
            <TableHead> Nombre </TableHead>
            <TableHead> Pase </TableHead>
            <TableHead> Aciertos </TableHead>
            <TableHead> Reclamos </TableHead>
            <TableHead> Subtotal </TableHead>
            <TableHead> Saldo Anterior </TableHead>
            <TableHead> Cobros </TableHead>
            <TableHead> Pagos </TableHead>
            <TableHead> Total </TableHead>
            <TableHead> Arrastre </TableHead>
            <TableHead> Deje </TableHead>
            <TableHead> Grupo </TableHead>
          </TableRow>
        </TableHeader>

        <TableBody className="border">
          {isLoading || isPending ? (
            <TableRow>
              <TableCell colSpan={14}>
                <SkeletonList />
              </TableCell>
            </TableRow>
          ) : data?.length === 0 ? (
            <TableRow>
              <TableCell colSpan={14} className="text-center">
                <FlexCol className="w-full items-center justify-center gap-3 py-8">
                  <Typography variant="large">No se encontraron Datos</Typography>
                  <Typography variant="small" className="font-light text-muted-foreground">
                    Por favor realice una nueva búsqueda
                  </Typography>
                </FlexCol>
              </TableCell>
            </TableRow>
          ) : (
            data?.map((account: ICurrentAccountEntityFront) => (
              <TableRow key={account.current_account_id}>
                <TableCell>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      handleClick(account);
                    }}
                  >
                    Liquidar
                  </Button>
                </TableCell>
                <TableCell>{account.user_number}</TableCell>
                <TableCell>{account.user_name}</TableCell>
                <TableCell>{account.pass}</TableCell>
                <TableCell>{account.successes}</TableCell>
                <TableCell>{account.claims}</TableCell>
                <TableCell>{account.subtotal}</TableCell>
                <TableCell>{account.previous_balance}</TableCell>
                <TableCell>{account.collections}</TableCell>
                <TableCell>{account.paid}</TableCell>
                <TableCell>{account.total}</TableCell>
                <TableCell>{account.drag}</TableCell>
                <TableCell>{account.leave}</TableCell>
                <TableCell></TableCell>
              </TableRow>
            ))
          )}
        </TableBody>

        <TableFooter className="border">
          <TableRow>
            <TableCell colSpan={3}>Total General</TableCell>
            <TableCell>${totals?.pass}</TableCell>
            <TableCell>${totals?.successes}</TableCell>
            <TableCell>${totals?.claims}</TableCell>
            <TableCell>${totals?.subtotal.toFixed(2)}</TableCell>
            <TableCell>${totals?.previous_balance.toFixed(2)}</TableCell>
            <TableCell>${totals?.collections.toFixed(2)}</TableCell>
            <TableCell>${totals?.paid.toFixed(2)}</TableCell>
            <TableCell>${totals?.total.toFixed(2)}</TableCell>
            <TableCell>${totals?.drag.toFixed(2)}</TableCell>
            <TableCell>${totals?.leave.toFixed(2)}</TableCell>
          </TableRow>
        </TableFooter>
      </Table>
      <Suspense fallback={<div>Cargando...</div>}>
        <UserCurrentAccountModal isOpen={isOpen} onClose={() => setIsOpen(false)} currentAccount={currentAccount} />
      </Suspense>
    </Box>
  );
};

export default CurrentAccountTable;
const UserCurrentAccountModal = React.lazy(() => import('../../../components/modals/UserCurrentAccountModal'));
