import { Flex, FlexCol } from '@/components/flex';
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
import { usePlayDetails } from './context/MakePlaysContext';
import { IBetTable } from '@helper/request/ticket.response';

const PlayDetailGameTable = () => {
  const { bets, selectedIndexes, setSelectedIndexes } = usePlayDetails();
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

  const toggleSelection = (index: number) => {
    setSelectedIndexes((prev) =>
      prev.includes(index) ? prev.filter((i) => i !== index) : [...prev, index]
    );
  };

  return (
    <div className="flex-1 overflow-y-auto overflow-x-hidden min-h-40 lg:min-h-32 max-h-full w-full">
      {/* Mobile: Cards */}
      <FlexCol className="md:hidden justify-center space-y-2 p-2">
        {bets.length === 0 ? (
          <NoPlaysFound />
        ) : (
          bets.map((bet, index) => (
            <BetCard
              key={index}
              bet={bet}
              index={index}
              isSelected={selectedIndexes.includes(index)}
              onToggle={() => toggleSelection(index)}
            />
          ))
        )}
      </FlexCol>

      {/* Desktop/Tablet: Table */}
      <div className="hidden md:block overflow-x-auto">
        <Table className="w-full min-w-[600px]">
          <TableHeader className="sticky top-0 bg-background z-10">
            <TableRow className="lg:h-9">
              <TableHead className="text-xs lg:text-base ">Jugada</TableHead>
              <TableHead className="text-xs lg:text-base ">Con</TableHead>
              <TableHead className="text-xs lg:text-base ">Monto</TableHead>
              <TableHead className="text-xs lg:text-base ">JugadaT</TableHead>
              <TableHead className="text-xs lg:text-base ">Jugada en/Turno</TableHead>
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
                    className={cn(
                      'cursor-pointer select-none text-slate-300 text-sm lg:text-xs lg:h-8'
                    )}
                    onMouseDown={() => {
                      dragStarted.current = false;
                      setIsSelecting(true);
                    }}
                    onMouseMove={() => {
                      dragStarted.current = true;
                    }}
                    onMouseEnter={() => {
                      if (isSelecting) {
                        setSelectedIndexes((prev) =>
                          prev.includes(index) ? prev.filter((i) => i !== index) : [...prev, index]
                        );
                      }
                    }}
                    onClick={() => {
                      if (!dragStarted.current) {
                        toggleSelection(index);
                      }
                    }}
                  >
                    <TableCell className="text-sm lg:text-base px-1 2xl:px-2 lg:py-1">
                      {bet.number}
                    </TableCell>
                    <TableCell className="text-sm lg:text-base px-1 2xl:px-2 lg:py-1">
                      {bet.with}
                    </TableCell>
                    <TableCell className="text-sm lg:text-base px-1 2xl:px-2 lg:py-1">
                      {bet.amount}
                    </TableCell>
                    <TableCell className="text-sm lg:text-base px-1 2xl:px-2 lg:py-1">{`${betPlaceDictionary[bet.place]} ${bet?.position ? betPlaceDictionary[bet.position] : ''}`}</TableCell>
                    <TableCell className="whitespace-normal break-words text-sm lg:text-base px-1 2xl:px-2 lg:py-1 max-w-xs">
                      <span className="">
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
    </div>
  );
};

// Componente Card para Mobile
const BetCard = ({
  bet,
  isSelected,
  onToggle,
}: {
  bet: IBetTable;
  index: number;
  isSelected: boolean;
  onToggle: () => void;
}) => {
  return (
    <div
      onClick={onToggle}
      className={cn(
        'border rounded-lg px-3 py-1 cursor-pointer transition-all',
        isSelected
          ? 'bg-primary/20 border-primary'
          : 'bg-card border-border hover:border-primary/50'
      )}
    >
      <Flex className="justify-between items-start mb-1">
        <div>
          <Typography variant="small" className="text-muted-foreground text-xs">
            Jugada
          </Typography>
          <Typography variant="large" className="font-semibold text-base">
            {bet.number}
          </Typography>
        </div>
        <div className="text-right">
          <Typography variant="small" className="text-muted-foreground text-xs">
            Monto
          </Typography>
          <Typography variant="large" className="font-semibold text-base text-primary">
            ${bet.amount}
          </Typography>
        </div>
      </Flex>

      <div className="grid grid-cols-2 gap-2 text-sm">
        <div>
          <span className="text-muted-foreground text-xs">Con: </span>
          <span className="font-medium">{bet.with || '-'}</span>
        </div>
        <div>
          <span className="text-muted-foreground text-xs">Tipo: </span>
          <span className="font-medium">
            {`${betPlaceDictionary[bet.place]} ${bet?.position ? betPlaceDictionary[bet.position] : ''}`}
          </span>
        </div>
      </div>

      <div className="mt-1 pt-1 border-t border-border">
        <Typography variant="small" className="text-muted-foreground text-xs mb-1">
          Turnos/Quinielas
        </Typography>
        <Typography variant="small" className="text-xs line-clamp-7">
          {bet.scheduleLottery.map((lotSched) => {
            return `${lotSched.schedule.name}-[${lotSched.lotteries.map((lot) => lot.name).join(', ')}] `;
          })}
        </Typography>
      </div>
    </div>
  );
};

export default PlayDetailGameTable;

const NoPlaysFound = () => (
  <TableRow className='w-full'>
    <TableCell colSpan={5} className="flex justify-center md:table-cell text-center !py-[36px]">
      <FlexCol className="items-center justify-center gap-3">
        <Typography variant={'large'}>No se encontraron jugadas</Typography>
        <Typography variant={'small'} className={'font-light text-muted-foreground'}>
          Por favor cargue nuevas jugadas
        </Typography>
      </FlexCol>
    </TableCell>
  </TableRow>
);
