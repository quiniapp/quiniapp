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
import { CurrentAccountTableProps } from '@/types/current-account.type.ts';



const CurrentAccountTable = ({ data, totals, isLoading, isPending }: CurrentAccountTableProps) => {


  return (
    <Box className="py-[36px]">
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
            <TableHead> Debe </TableHead>
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
          ) : data.length === 0 ? (
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
            data.map((account: any) => (
              <TableRow key={account.current_account_id}>

                <TableCell>
                  <Button variant="outline" size="sm">Liquidar</Button>
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
            <TableCell>{totals.pass}</TableCell>
            <TableCell>{totals.successes}</TableCell>
            <TableCell>{totals.claims}</TableCell>
            <TableCell>${totals.subtotal.toFixed(2)}</TableCell>
            <TableCell>${totals.previous_balance.toFixed(2)}</TableCell>
            <TableCell>${totals.collections.toFixed(2)}</TableCell>
            <TableCell>${totals.paid.toFixed(2)}</TableCell>
            <TableCell>${totals.total.toFixed(2)}</TableCell>
            <TableCell>${totals.drag.toFixed(2)}</TableCell>
            <TableCell>${totals.leave.toFixed(2)}</TableCell>
            <TableCell></TableCell>
          </TableRow>
        </TableFooter>
      </Table>
    </Box>
  );
};

export default CurrentAccountTable;