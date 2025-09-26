import FillOutATicket from '@/features/play-details/fill-out-a-ticket.tsx';
import HeaderPlayDetail from '@/features/play-details/header-play-detail.tsx';
import { useEffect, useState } from 'react';
import ResultsOverview from './results-overview';
import { useCreateTicket } from '@/hooks/mutations/tickets/useTicket';
import { INewBetEntity } from '../../../../helper/request/bet.response';
import PlayDetailGameTable from './play-detail-game-table';
import { FlexCol } from '@/components/flex';
import dayjs from 'dayjs';
import toast from 'react-hot-toast';
import { IUserEntityFront, USER_TYPE } from '../../../../helper/types/user.type';
import { ILotteryEntityFront } from '../../../../helper/types/lottery.type';
import { IScheduleEntityFront } from '../../../../helper/types/schedule.type';
import { PLACE_TYPE } from '../../../../helper/types/bet.type';
import { betTypeDictionary } from '../../../../helper/functions/betTypeDictionary';
import { useUsersByNumber } from '@/hooks/fetchs/users/useUsersByNumber';
import customParseFormat from 'dayjs/plugin/customParseFormat';
import { makeTicketPdf } from '../../../helper/function/makeTicket';
import { ITicketEntityFront } from '../../../../helper/types/ticket.type';
import { useEditTicket } from '@/hooks/mutations/tickets/useEditTicket';
import {groupTicketBetsByNumber} from '../../../helper/function/groupNumber'
import { useAuth } from '@/contexts/AuthContext';

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
  const { user } = useAuth();
  const [ticketId, setTicketId] = useState<string | undefined>(undefined);
  const [totalAmount, setTotalAmount] = useState<number>(0);
  const [partialAmount, setPartialAmount] = useState<number>(0);
  const [bets, setBets] = useState<IBetTable[]>([]);
  const [cashier, setCashier] = useState<IUserEntityFront | undefined>(undefined);
  const [lotteries, setLotteries] = useState<Map<string, ILotteryEntityFront>>(new Map());
  const [schedules, setSchedules] = useState<Map<string, IScheduleEntityFront>>(new Map());
  const { mutate: createTicket } = useCreateTicket();
  const [selectedIndexes, setSelectedIndexes] = useState<number[]>([]);
  const [userNumber, setUserNumber] = useState<number | undefined>(undefined);
  const { data } = useUsersByNumber(userNumber);
  const [isEnabledCreateBet, setIsEnabledCreateBet] = useState<boolean>(false);
  const { mutate: editTicket } = useEditTicket();
  const computeTotal = (bets: IBetTable[]) =>
    bets.reduce((acc, bet) => {
      const combos = bet.scheduleLottery.reduce((s, it) => s + it.lotteries.length, 0);
      const amount =
        typeof bet.amount === 'string' ? parseFloat(bet.amount as any) : (bet.amount ?? 0);
      return acc + amount * combos;
    }, 0);

  const handleRecreateBet = (values: IBetTable[]) => {
    setBets(values);

    const total = computeTotal(values);
    setPartialAmount(total); // reemplaza, no suma
    setTotalAmount(total); // reemplaza, no suma

    setSelectedIndexes([]);
    setIsEnabledCreateBet(true);
  };

  //! ResultsOverview crea el ticket
  const handleCreateBet = () => {
    setIsEnabledCreateBet(false);
    const today = dayjs().format('YYYY-MM-DD');

    const newBets: INewBetEntity[] = [...bets].reverse().flatMap((bet) =>
      bet.scheduleLottery.flatMap((schedLot) =>
        schedLot.lotteries.map((lot) => ({
          number: bet.number,
          amount: +bet.amount!,
          place: bet.place,
          with: bet?.with,
          position: bet?.position,
          bet_type: betTypeDictionary(bet.number?.length, !!bet.with?.length)!,
          lottery_id: lot.lottery_id,
          schedule_id: schedLot.schedule.schedule_id,
          user_id: cashier?.user_id ?? user?.user_id!,
          date: today,
          user_name: `${cashier?.name ?? user?.name!}-${cashier?.number ?? user?.number}`,
          cashier_name: `${cashier?.name ?? user?.name!}-${cashier?.number ?? user?.number}`,
        }))
      )
    );
    if (!ticketId) {
      createTicket(
        {
          bets: newBets,
          date: today,
          user_id: cashier?.user_id ?? user?.user_id!,
          user_name: `${cashier?.name ?? user?.name!}-${cashier?.number ?? user?.number}`,
        },
        {
          onSuccess: (res) => {
            const lastTicket = {
              bets: [...bets].reverse(),
              ticket: res.data.ticket,
              cashier_number: user?.number,
            };
            if (user?.user_type === USER_TYPE.CASHIER) {
              makeTicketPdf(lastTicket);
            }

            localStorage.setItem('lastTicket', JSON.stringify(lastTicket));
            setBets([]);
            setPartialAmount(0);
            setTotalAmount(0);
            setCashier(undefined);
            setLotteries(new Map());
            setSchedules(new Map());
            setUserNumber(undefined);
            setIsEnabledCreateBet(true);
            setSelectedIndexes([]);
            setTicketId(undefined);
            toast.success('Ticket creado correctamente');
          },
          onError: (err) => {
            console.error(err)
            setIsEnabledCreateBet(true);
            toast.error('Ocurrió un error, intente de nuevo');
          },
        }
      );
    } else {
      editTicket(
        { ticket_id: ticketId, bets: newBets },
        {
          onSuccess: () => {


            setBets([]);
            setPartialAmount(0);
            setTotalAmount(0);
            setCashier(undefined);
            setLotteries(new Map());
            setSchedules(new Map());
            setUserNumber(undefined);
            setIsEnabledCreateBet(true);
            setSelectedIndexes([]);
            setTicketId(undefined);
            toast.success('Ticket modificado correctamente');
          },
          onError: (err) => {
            console.error(err)
            setIsEnabledCreateBet(true);
            toast.error('Ocurrió un error al modificar el ticket, intente de nuevo');
          },
        }
      );
    }
  };

  const handleEditTicket = (ticket: ITicketEntityFront) => {
    setTicketId(ticket.ticket_id);
    setSelectedIndexes([]);
    setTotalAmount(0);
    setPartialAmount(0);
     const groupedBets = groupTicketBetsByNumber(ticket);

  // 2) setear bets ya agrupadas
  setBets(groupedBets);

  // 3) total: similar a RepeatTicketModal (amount * #loterías seleccionadas por jugada)
  const total = groupedBets.reduce((acc, b) => {
    const lotCount = b.scheduleLottery.reduce((c, s) => c + s.lotteries.length, 0);
    const amount = typeof b.amount === 'string' ? parseFloat(b.amount) : (b.amount ?? 0);
    return acc + amount * lotCount;
  }, 0);
  setTotalAmount(total);
    // setBets(
    //   ticket.bets.map((bet) => {
    //     setTotalAmount((prev) => prev + bet.amount);
    //     return {
    //       number: bet.number,
    //       amount: bet.amount,
    //       place: bet.place,
    //       with: bet.with,
    //       position: bet.position,
    //       scheduleLottery: [
    //         {
    //           schedule: bet.schedule,
    //           lotteries: [bet.lottery],
    //         },
    //       ],
    //     };
    //   })
    // );
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
    setPartialAmount((prev) => prev - reduction);
    setTotalAmount((prev) => prev - reduction);
    setSelectedIndexes([]);
  };

  useEffect(() => {
    if (!userNumber) setCashier(undefined);
    if (data) {
      setCashier(data);
    }
  }, [userNumber, data]);

  const isEnabledCreateBetByAdmin =
    (user?.user_type !== USER_TYPE.CASHIER && !!cashier) || user?.user_type === USER_TYPE.CASHIER;

  return (
    <FlexCol className={'h-full sm:w-[1000px] 1440:w-full overflow-y-auto sm:overflow-hidden'}>
      <HeaderPlayDetail
        cashier={cashier}
        setUserNumber={setUserNumber}
        userNumber={userNumber}
        handleRecreateBet={handleRecreateBet}
        handleEditTicket={handleEditTicket}
        setTotalAmount={setTotalAmount}
        setPartialAmount={setPartialAmount}
      />

      <FillOutATicket
        setTotalAmount={setTotalAmount}
        setPartialAmount={setPartialAmount}
        setBets={setBets}
        lotteries={lotteries}
        setLotteries={setLotteries}
        schedules={schedules}
        setSchedules={setSchedules}
        isEnabled={isEnabledCreateBet && isEnabledCreateBetByAdmin}
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
        isEnabled={isEnabledCreateBet && isEnabledCreateBetByAdmin}
      />
    </FlexCol>
  );
};

export default PlayDetailsContent;
