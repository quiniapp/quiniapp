import {
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';

const PlaysAndHitsTable = () => {
  return (
    <Table>
      <TableCaption>A list of your recent invoices.</TableCaption>
      <TableHeader>
        <TableRow className={'bg-[var(--bg-card)] h-[56px]'}>
          <TableHead className="w-[100px]">Juagada</TableHead>
          <TableHead>Monto</TableHead>
          <TableHead>Tipo</TableHead>
          <TableHead>Turno</TableHead>
          <TableHead>Quiniela</TableHead>
          <TableHead>Aciertos</TableHead>
          <TableHead>MontoAciertos</TableHead>
          <TableHead>Ticket</TableHead>
          <TableHead>Usuario</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        <TableRow>
          <TableCell className="font-medium">INV001</TableCell>
          <TableCell>Paid</TableCell>
          <TableCell>Credit Card</TableCell>
          <TableCell>$250.00</TableCell>
          <TableCell>$250.00</TableCell>
          <TableCell>$250.00</TableCell>
          <TableCell>$250.00</TableCell>
          <TableCell>$250.00</TableCell>
          <TableCell>$250.00</TableCell>
        </TableRow>
        <TableRow>
          <TableCell className="font-medium">INV001</TableCell>
          <TableCell>Paid</TableCell>
          <TableCell>Credit Card</TableCell>
          <TableCell>$250.00</TableCell>
          <TableCell>$250.00</TableCell>
          <TableCell>$250.00</TableCell>
          <TableCell>$250.00</TableCell>
          <TableCell>$250.00</TableCell>
          <TableCell>$250.00</TableCell>
        </TableRow>{' '}
        <TableRow>
          <TableCell className="font-medium">INV001</TableCell>
          <TableCell>Paid</TableCell>
          <TableCell>Credit Card</TableCell>
          <TableCell>$250.00</TableCell>
          <TableCell>$250.00</TableCell>
          <TableCell>$250.00</TableCell>
          <TableCell>$250.00</TableCell>
          <TableCell>$250.00</TableCell>
          <TableCell>$250.00</TableCell>
        </TableRow>{' '}
        <TableRow>
          <TableCell className="font-medium">INV001</TableCell>
          <TableCell>Paid</TableCell>
          <TableCell>Credit Card</TableCell>
          <TableCell>$250.00</TableCell>
          <TableCell>$250.00</TableCell>
          <TableCell>$250.00</TableCell>
          <TableCell>$250.00</TableCell>
          <TableCell>$250.00</TableCell>
          <TableCell>$250.00</TableCell>
        </TableRow>
      </TableBody>
    </Table>
  );
};

export default PlaysAndHitsTable;
