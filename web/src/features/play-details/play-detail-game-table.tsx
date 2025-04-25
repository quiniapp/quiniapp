import { Table, TableBody, TableHead, TableHeader, TableRow, TableCell } from '@/components/ui/table';
import { Typography } from '@/components/typography';
import { FlexCol } from '@/components/flex';

const PlayDetailGameTable = () => {
  const tablePlays = [];

  const NoPlaysFound = () => (
    <TableRow>
      <TableCell colSpan={6} className="text-center !py-[36px]">
        <FlexCol className="items-center justify-center gap-3">
          <Typography variant={'large'}>No se encontraron jugadas</Typography>
          <Typography variant={'small'} className={'font-light text-muted-foreground'}>Por favor cargue nuevas jugadas</Typography>
        </FlexCol>
      </TableCell>
    </TableRow>
  );

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Jugada</TableHead>
          <TableHead>Con</TableHead>
          <TableHead>Monto</TableHead>
          <TableHead>JugadaT</TableHead>
          <TableHead>Bloque</TableHead>
          <TableHead className="text-right">Jugada en</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {tablePlays.length === 0 ? <NoPlaysFound /> : <div>tabla</div>}
      </TableBody>
    </Table>
  );
};

export default PlayDetailGameTable;
