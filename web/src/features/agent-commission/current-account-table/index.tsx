import {
  Table,
  TableBody,
  TableCell,
  TableFooter,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { FlexCol } from '@/components/flex';
import { Typography } from '@/components/typography';
import Box from '@/components/box';

const CurrentAccountTable = () => {
  const DATA = [];
  return (
    <Box className={'py-[36px]'}>
      <Table className={'overflow-hidden  rounded-[16px_16px_0_0] '}>
        <TableHeader className={'border overflow-hidden rounded-[16px_16px_0_0]'}>
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
        </TableHeader>
        <TableBody className={'border'}>
          {DATA.length === 0 ? (
            <TableRow>
              <TableCell colSpan={14} className={' text-center'}>
                <FlexCol className={' w-full items-center justify-center gap-3 py-8 '}>
                  <Typography variant={'large'}>No se encontraron Datos</Typography>
                  <Typography variant={'small'} className={'font-light text-muted-foreground'}>
                    Por favor realice una nueva búsqueda
                  </Typography>
                </FlexCol>
              </TableCell>
            </TableRow>
          ) : (
            <div> si hay</div>
          )}
        </TableBody>
        <TableFooter className={'border'}>
          <TableCell>Total</TableCell>
          <TableCell> </TableCell>
          <TableCell></TableCell>
          <TableCell>$1,568</TableCell>
          <TableCell>$684.9</TableCell>
          <TableCell>$213.0</TableCell>
          <TableCell>$354.7</TableCell>
          <TableCell>$358.6 </TableCell>
          <TableCell>$130.0</TableCell>
          <TableCell>$240.0</TableCell>
          <TableCell>$823.3</TableCell>
          <TableCell>$6,042</TableCell>
          <TableCell>$0.00</TableCell>
          <TableCell></TableCell>
        </TableFooter>
      </Table>
    </Box>
  );
};

export default CurrentAccountTable;
