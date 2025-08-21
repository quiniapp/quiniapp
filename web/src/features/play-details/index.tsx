import FillOutATicket from '@/features/play-details/fill-out-a-ticket.tsx';
import HeaderPlayDetail from '@/features/play-details/header-play-detail.tsx';
import {  useEffect,  useState } from 'react';
import ResultsOverview from './results-overview';
import { useCreateTicket } from '@/hooks/useTicket';
import { INewBetEntity } from '../../../../helper/request/bet.response';
import PlayDetailGameTable from './play-detail-game-table';
import { FlexCol } from '@/components/flex';
import { useSessionStore } from '@/stores/sessionStore';
import dayjs from 'dayjs';
import toast from 'react-hot-toast';
import { IUserEntityFront } from '../../../../helper/types/user.type';
import { ILotteryEntityFront } from '../../../../helper/types/lottery.type';
import { IScheduleEntityFront } from '../../../../helper/types/schedule.type';
import { PLACE_TYPE } from '../../../../helper/types/bet.type';
import { betTypeDictionary } from '../../../../helper/functions/betTypeDictionary';
import { useUsersByNumber } from '@/hooks/fetchs/users/useUsersByNumber';
import customParseFormat from 'dayjs/plugin/customParseFormat';
import {makeTicketPdf} from '../../../helper/function/makeTicket'

dayjs.extend(customParseFormat);
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

const PlayDetailsContent = () => {
  const { user } = useSessionStore();
  const [totalAmount, setTotalAmount] = useState<number>(0);
  const [partialAmount, setPartialAmount] = useState<number>(0);
  const [bets, setBets] = useState<IBetTable[]>([]);
  const [cashier, setCashier] = useState<IUserEntityFront | undefined>(undefined);
  const [lotteries, setLotteries] = useState<Map<string, ILotteryEntityFront>>(new Map());
  const [schedules, setSchedules] = useState<Map<string, IScheduleEntityFront>>(new Map());
  const { mutate: createTicket, isPending } = useCreateTicket();
  const [selectedIndexes, setSelectedIndexes] = useState<number[]>([]);
  const [userNumber, setUserNumber] = useState<number | undefined>(undefined);
  const { data } = useUsersByNumber(userNumber);
  const [isEnabledCreateBet, setIsEnabledCreateBet] = useState<boolean>(false);
  //! ResultsOverview crea el ticket
  const handleCreateBet = () => {
    setIsEnabledCreateBet(false);
    const today = dayjs().format('YYYY-MM-DD');

    const newBets: INewBetEntity[] = bets.flatMap((bet) =>
      bet.scheduleLottery.flatMap((schedLot) =>
        schedLot.lotteries.map((lot) => ({
          number: bet.number,
          amount: +bet.amount!,
          place: bet.place,
          with: bet.with,
          position: bet.position,
          bet_type: betTypeDictionary(bet.number?.length, !!bet.with?.length),
          lottery_id: lot.lottery_id,
          schedule_id: schedLot.schedule.schedule_id,
          user_id: cashier?.user_id ?? user?.user_id!,
          date: today,
          user_name: `${cashier?.name ?? user?.name!}-${cashier?.number ?? user?.number}`,
          cashier_name: `${cashier?.name ?? user?.name!}-${cashier?.number ?? user?.number}`,
        }))
      )
    );
    createTicket(
      {
        bets: newBets,
        date: today,
        user_id: cashier?.user_id ?? user?.user_id!,
        user_name: `${cashier?.name ?? user?.name!}-${cashier?.number ?? user?.number}`,
      },
      {
        onSuccess: (res) => {
          makeTicketPdf(res.data.ticket, bets)
          setBets([]);
          setPartialAmount(0);
          setTotalAmount(0);
          setCashier(undefined);
          setLotteries(new Map());
          setSchedules(new Map());
          setUserNumber(undefined);
          setIsEnabledCreateBet(true);
          toast.success('Ticket creado correctamente');
        },
        onError: () => {
          setIsEnabledCreateBet(true);
          toast.error('Ocurrió un error, intente de nuevo');
        },
      }
    );
  };

  const handleResetBets = () => {
    setBets([]);
    setPartialAmount(0);
    setTotalAmount(0);
  };

  const handleDeleteSelectedBets = () => {
    if (selectedIndexes.length === 0) return;

    let reduction = 0;

    const updatedBets = bets.filter((bet, idx) => {
      if (selectedIndexes.includes(idx)) {
        reduction +=
          bet.amount *
          bet.scheduleLottery.reduce((acc, schedLot) => acc + schedLot.lotteries.length, 0);
        return false; // eliminar
      }
      return true;
    });

    setBets(updatedBets);
    setPartialAmount((prev) => (prev - reduction >= 0 ? prev - reduction : 0));
    setTotalAmount((prev) => prev - reduction);
    setSelectedIndexes([]);
  };

  useEffect(() => {
    if (data) {
      setCashier(data);
    }
  }, [userNumber, data]);

  return (
    <FlexCol className={'h-full sm:w-[1000px] 1440:w-full overflow-y-auto sm:overflow-hidden'}>
      <HeaderPlayDetail cashier={cashier} setUserNumber={setUserNumber} userNumber={userNumber} />

      <FillOutATicket
        setTotalAmount={setTotalAmount}
        setPartialAmount={setPartialAmount}
        setBets={setBets}
        lotteries={lotteries}
        setLotteries={setLotteries}
        schedules={schedules}
        setSchedules={setSchedules}
        isEnabled={isEnabledCreateBet}
        setIsEnabledCreateBet={setIsEnabledCreateBet}
      />
      <PlayDetailGameTable
        bets={bets}
        selectedIndexes={selectedIndexes}
        setSelectedIndexes={setSelectedIndexes}
      />
      <ResultsOverview
        partialAmount={partialAmount}
        totalAmount={totalAmount}
        handleCreateBet={handleCreateBet}
        handleResetBets={handleResetBets}
        onDeleteSelected={handleDeleteSelectedBets}
        hasSelection={selectedIndexes.length > 0}
        isEnabled={isEnabledCreateBet}
      />

    </FlexCol>
  );
};

export default PlayDetailsContent;

