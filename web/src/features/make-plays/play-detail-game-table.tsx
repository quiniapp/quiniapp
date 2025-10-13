import { FlexCol } from '@/components/flex';
import { Typography } from '@/components/typography';
import {
  Table,
  TableBody,
  TableHead,
  TableHeader,
  TableRow,
  TableCell,
} from '@/components/ui/table';
import { betPlaceDictionary } from '@helper/functions/betPlaceDictionary';

import { useEffect, useRef, useState } from 'react';
import { cn } from '@/lib/utils';
import { IBetTable } from '@helper/request/ticket.response';

const PlayDetailGameTable = ({
  bets,
  selectedIndexes,
  setSelectedIndexes,
}: {
  bets: IBetTable[];
  selectedIndexes: number[];
  setSelectedIndexes: React.Dispatch<React.SetStateAction<number[]>>;
}) => {
  const [isSelecting, setIsSelecting] = useState(false);
  const dragStarted = useRef(false);

  useEffect(() => {
    const handleMouseUp = () => setIsSelecting(false);
    window.addEventListener('mouseup', handleMouseUp);
    return () => window.removeEventListener('mouseup', handleMouseUp);
  }, []);
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setSelectedIndexes([]);
        setIsSelecting(false);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  return (
    <div className="flex-1 overflow-y-auto min-h-40">
      <Table className=" ">
        <TableHeader>
          <TableRow>
            <TableHead>Jugada</TableHead>
            <TableHead>Con</TableHead>
            <TableHead>Monto</TableHead>
            <TableHead>JugadaT</TableHead>
            <TableHead>Jugada en/Turno</TableHead>
          </TableRow>
        </TableHeader>

        <TableBody>
          {bets.length === 0 ? (
            <NoPlaysFound />
          ) : (
            bets.map((bet, index) => {
              return (
                <TableRow
                  key={index}
                  data-state={selectedIndexes.includes(index) ? 'selected' : undefined}
                  className={cn('cursor-pointer select-none text-slate-300')}
                  onMouseDown={() => {
                    dragStarted.current = false;
                    setIsSelecting(true);
                  }}
                  onMouseMove={() => {
                    dragStarted.current = true;
                  }}
                  onMouseEnter={() => {
                    if (isSelecting) {
                      setSelectedIndexes(
                        (prev) =>
                          prev.includes(index)
                            ? prev.filter((i) => i !== index) // des-seleccionar
                            : [...prev, index] // seleccionar
                      );
                    }
                  }}
                  onClick={() => {
                    if (!dragStarted.current) {
                      setSelectedIndexes((prev) =>
                        prev.includes(index) ? prev.filter((i) => i !== index) : [...prev, index]
                      );
                    }
                  }}
                >
                  <TableCell>{bet.number}</TableCell>
                  <TableCell>{bet.with}</TableCell>
                  <TableCell>{bet.amount}</TableCell>
                  <TableCell>{`${betPlaceDictionary[bet.place]} ${bet?.position ? betPlaceDictionary[bet.position] : ''}`}</TableCell>
                  <TableCell className="whitespace-normal break-words">
                    <span>
                      {bet.scheduleLottery.map((lotSched) => {
                        return `${lotSched.schedule.name}-[${lotSched.lotteries.map((lot) => lot.name).join(', ')}] //`;
                      })}
                    </span>
                  </TableCell>
                </TableRow>
              );
            })
          )}
        </TableBody>
      </Table>
    </div>
  );
};

export default PlayDetailGameTable;

const NoPlaysFound = () => (
  <TableRow>
    <TableCell colSpan={6} className="text-center !py-[36px]">
      <FlexCol className="items-center justify-center gap-3">
        <Typography variant={'large'}>No se encontraron jugadas</Typography>
        <Typography variant={'small'} className={'font-light text-muted-foreground'}>
          Por favor cargue nuevas jugadas
        </Typography>
      </FlexCol>
    </TableCell>
  </TableRow>
);
