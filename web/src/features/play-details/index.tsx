import Box from '@/components/box';
import FillOutATicket from '@/features/play-details/fill-out-a-ticket.tsx';
import HeaderPlayDetail from '@/features/play-details/header-play-detail.tsx';
import { useCallback, useState } from 'react';
import ResultsOverview from './results-overview';
import { useCreateTicket } from '@/hooks/useTicket';
import { INewBetEntity } from '../../../../helper/request/bet.response';
import PlayDetailGameTable from './play-detail-game-table';
import { Flex, FlexCol } from '@/components/flex';
import { useSessionStore } from '@/stores/sessionStore';
import dayjs from 'dayjs';
import toast from 'react-hot-toast';
import { IUserEntityFront } from '../../../../helper/types/user.type';
import { ILotteryEntityFront } from '../../../../helper/types/lottery.type';
import { IScheduleEntityFront } from '../../../../helper/types/schedule.type';
import { PLACE_TYPE } from '../../../../helper/types/bet.type';

export interface ILotterySchedule {
  lotteries: ILotteryEntityFront;
  schedules: IScheduleEntityFront;
}
export interface IBetTable {
  number: string;
  with: string;
  amount: number;
  place: PLACE_TYPE;
  position?: PLACE_TYPE | null;
  scheduleLottery: ILotterySchedule[];
}

/* 
  <TableRow key={index}>
                  <TableCell>{bet.number}</TableCell>
                  <TableCell>{bet.with}</TableCell>
                  <TableCell>{bet.amount}</TableCell>
                  <TableCell>{`${betPlaceDictionary[bet.place]} ${bet?.position ? betPlaceDictionary[bet.position] : ''}`}</TableCell>
                  <TableCell>{bet.lotteries.name}</TableCell>
                  <TableCell className="text-right">{bet.schedules.name}</TableCell>
                </TableRow>


*/
const PlayDetailsContent = () => {
  const today = dayjs();
  const { user } = useSessionStore();
  const [totalAmount, setTotalAmount] = useState<number>(0);
  const [partialAmount, setPartialAmount] = useState<number>(0);
  const [bets, setBets] = useState<IBetTable[]>([]);
  const [cashier, setCashier] = useState<IUserEntityFront | undefined>(undefined);
  const { mutate: createTicket } = useCreateTicket();

  //! ResultsOverview crea el ticket
  const handleCreateBet = () => {
    /* 
      const handleCreateBet = () => {
        const date = dayjs().format('YYYY-MM-DD');
    
        const lotterySchedule = Array.from(lotteries.values()).flatMap((lot) =>
          Array.from(schedules.values()).map((sch) => ({
            schedule_id: sch.schedule_id,
            lottery_id: lot.lottery_id,
            schedules: sch,
            lotteries: lot,
          }))
        );
        setBets((prev) => {
          const newBet = lotterySchedule.map((lotSched) => {
            return {
              ...lotSched,
              number: bet.number,
              amount: +bet.amount!,
              place: bet.place,
              with: bet.with,
              position: bet.position,
              bet_type: betTypeDictionary(bet.number?.length, !!bet.with?.length),
              date: date,
              user_id: user?.user_id,
            } as INewBetEntity;
          });
          setPartialAmount((prev) => prev + newBet.reduce((prev, curr) => prev + curr.amount, 0));
          setTotalAmount((prev) => prev + newBet.reduce((prev, curr) => prev + curr.amount, 0));
          // Resetear campos del form
          setBet((prev) => ({
            ...prev,
            number: '',
          }));
    
          // También podés hacer focus al campo número si querés:
          numberRef.current?.focus();
    
          return [...newBet,...prev];
        });
      };
    
    
    */
    createTicket(
      {
        bets: bets,
        date: dayjs().format('YYYY-MM-DD'),
        user_id: cashier?.user_id ?? user?.user_id!,
        user_name: cashier?.name ?? user?.name!,
      },
      {
        onSuccess: () => {
          setBets([]);
          setPartialAmount(0);
          setTotalAmount(0);
          toast.success('Ticket creado correctamente');
        },
        onError: () => {
          toast.success('Ocurrió un error, intente de nuevo');
        },
      }
    );
  };

  const handleSearch = useCallback((searchCashier: IUserEntityFront) => {
    if (searchCashier) {
      setCashier(searchCashier);
    }
  }, []);

  const handleResetBets = () => {
    setBets([]);
    setPartialAmount(0);
    setTotalAmount(0);
  };
  return (
    <FlexCol className={'h-full  '}>
      <HeaderPlayDetail setCashier={handleSearch} />

      <FillOutATicket
        setTotalAmount={setTotalAmount}
        setPartialAmount={setPartialAmount}
        setBets={setBets}
      />
      <PlayDetailGameTable bets={bets} />

      <ResultsOverview
        partialAmount={partialAmount}
        totalAmount={totalAmount}
        handleCreateBet={handleCreateBet}
        handleResetBets={handleResetBets}
      />
    </FlexCol>
  );
};

export default PlayDetailsContent;
