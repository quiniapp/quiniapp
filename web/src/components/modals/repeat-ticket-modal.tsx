import Box from '@/components/box';
import { Flex, FlexCol } from '@/components/flex';
import Modal from '@/components/modals/custom-modal.tsx';
import { Typography } from '@/components/typography';
import { Button } from '@/components/ui/button.tsx';
import { Input } from '@/components/ui/input.tsx';
import { QuinielaFieldset } from '@/features/play-details/quiniela-fieldset.tsx';
import { useEffect, useState } from 'react';
import { getTicketByNumber } from '@/hooks/fetchs/tickets/useGetByNumber';
import { IBetTable } from '@/features/play-details';
import { useSchedules } from '@/hooks/useSchedules';
import { useLotteries } from '@/hooks/useLotteries';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../ui/table';
import { cn } from '@/lib/utils';
import { betPlaceDictionary } from '../../../../helper/functions/betPlaceDictionary';
import { useScheduleLottery } from '@/hooks/fetchs/schedule-lottery/useScheduleLottery';
import dayjs from 'dayjs';
import { dayParseToString } from '../../../../helper/functions/dayDictionary';

interface BasicModalProps {
  isOpen: boolean;
  title: string;
  description?: string;
  onClose: () => void;
  handleRecreateBet: (values: IBetTable[]) => void;
}

const RepeatTicketModal = ({ isOpen, title, onClose, handleRecreateBet }: BasicModalProps) => {
  if (!isOpen) return null;
  const today = dayjs().day();

  const [repeatBets, setRepeatBets] = useState<Map<string, IBetTable>>(new Map());
  const [scheduleLotteriesToPlay, setScheduleLotteriesToPlay] = useState<Map<string, string[]>>(
    new Map()
  );
  const [ticketNumber, setTicketNumber] = useState<string>('');
  const { data } = getTicketByNumber(ticketNumber);
  const { data: schedules } = useSchedules();
  const { data: lotteries } = useLotteries();
  const { data: scheduleLottery } = useScheduleLottery();
  console.log(scheduleLottery.scheduleLotteries[dayParseToString[today]]);
  /* 

export interface ILotterySchedule {
  schedule: IScheduleEntityFront;
  lotteries: ILotteryEntityFront[];
}
export interface IBetTable {
  number: string;
  amount: number;
  place: PLACE_TYPE;
  with: string | null;
  position?: PLACE_TYPE | null;
  scheduleLottery: ILotterySchedule[];
}
*/
  const handleSetBets = () => {
    handleRecreateBet(Array.from(repeatBets.values()));
    onClose();
  };
  useEffect(() => {
    if (data) {
      const newMap = new Map(repeatBets);
      data.bets.map((bet) => {
        if (newMap.has(bet.number)) {
          const newBet = newMap.get(bet.number);
          if (
            newBet?.scheduleLottery.some(
              (schLot) => schLot.schedule.schedule_id === bet.schedule.schedule_id
            )
          ) {
            newBet.scheduleLottery.map((schLot) => {
              if (schLot.schedule.schedule_id === bet.schedule.schedule_id) {
                schLot.lotteries.push(bet.lottery);
              }
            });
          } else {
            newBet?.scheduleLottery.push({
              schedule: bet.schedule,
              lotteries: [bet.lottery],
            });
          }
          newMap.set(bet.number, newBet as IBetTable);
        } else {
          newMap.set(bet.number, {
            number: bet.number,
            amount: bet.amount,
            place: bet.place,
            with: bet.with,
            position: bet.position,
            scheduleLottery: [
              {
                schedule: bet.schedule,
                lotteries: [bet.lottery],
              },
            ],
          });
        }
      });
      setRepeatBets(newMap);
    }
  }, [data]);
  return (
    <Modal
      title={title}
      isOpen={isOpen}
      onClose={onClose}
      className="!max-w-[980px]  w-full m-auto bg-[#060813] p-1 sm:p-3"
    >
      <Box className={'grid grid-cols-[1fr_3fr_1fr_5fr] items-center gap-5'}>
        <Flex className={'justify-end'}>
          <Typography variant={'small'}> Ticket N°: </Typography>
        </Flex>
        <Input
          type={'number'}
          value={ticketNumber}
          onChange={(e) => setTicketNumber(e.target.value)}
        />
      </Box>
      <Flex className={'p-1 sm:p-3 justify-center gap-1 sm:gap-3'}>
        {schedules?.map((sch) => {
          return (
            <QuinielaFieldset
              key={sch.schedule_id}
              legend={`${sch.name}-${sch.time.slice(0, 5)}`}
              namePrefix={'tone'}
              lotteries={lotteries ?? []}
            />
          );
        })}
      </Flex>
      <FlexCol className={'gap-1 sm:gap-3 items-center'}>
        <Flex>
          <span className="min-w-52 ">Monto total: ${data?.total ?? 0}</span>
          <Button variant={'outline'} type={'button'} className={'  flex justify-center'}>
            Selecionar todas
          </Button>
          <Button variant={'outline'} type={'button'} className={' flex justify-center'}>
            Modificar monto
          </Button>
          <Button variant={'outline'} type={'reset'} className={'   flex justify-center'}>
            Quitar todas
          </Button>
        </Flex>

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
              {Array.from(repeatBets.values()).map((bet, index) => {
                return (
                  <TableRow
                    key={index}
                    className={cn('cursor-pointer select-none text-slate-300')}
                    // data-state={selectedIndexes.includes(index) ? 'selected' : undefined}
                    // onMouseDown={() => {
                    //   dragStarted.current = false;
                    //   setIsSelecting(true);
                    // }}
                    // onMouseMove={() => {
                    //   dragStarted.current = true;
                    // }}
                    // onMouseEnter={() => {
                    //   if (isSelecting) {
                    //     setSelectedIndexes(
                    //       (prev) =>
                    //         prev.includes(index)
                    //           ? prev.filter((i) => i !== index) // des-seleccionar
                    //           : [...prev, index] // seleccionar
                    //     );
                    //   }
                    // }}
                    // onClick={() => {
                    //   if (!dragStarted.current) {
                    //     setSelectedIndexes((prev) =>
                    //       prev.includes(index) ? prev.filter((i) => i !== index) : [...prev, index]
                    //     );
                    //   }
                    // }}
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
              })}
            </TableBody>
          </Table>
        </div>
        <Flex className={'gap-3'}>
          <Box>
            <Button variant={'default'} onClick={handleSetBets}>
              AGREGAR JUGADAS
            </Button>
          </Box>
          <Box>
            <Button
              variant={'outline'}
              className={'bg-black'}
              onClick={() => {
                onClose();
              }}
            >
              {' '}
              CANCELAR
            </Button>
          </Box>
        </Flex>
      </FlexCol>
    </Modal>
  );
};

export default RepeatTicketModal;
