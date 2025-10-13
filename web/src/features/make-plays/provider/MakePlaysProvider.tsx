/* import React, {  useCallback,  useMemo, useState } from 'react';
import dayjs from 'dayjs';
import toast from 'react-hot-toast';

import { useAuth } from '@/contexts/AuthContext';
import { useCreateTicket } from '@/hooks/mutations/tickets/useTicket';
import { useEditTicket } from '@/hooks/mutations/tickets/useEditTicket';
import { useGetUserByNumber } from '@/hooks/fetchs/users/useUsersByNumber';
import { IScheduleEntityFront } from '@helper/types/schedule.type';
import { ILotteryEntityFront } from '@helper/types/lottery.type';
import { IUserEntityFront, USER_TYPE } from '@helper/types/user.type';
import { ITicketEntityFront } from '@helper/types/ticket.type';
import { INewBetEntity } from '@helper/request/bet.response';
import { betTypeDictionary } from '@helper/functions/betTypeDictionary';
import { Ctx, IBetTable, PlayDetailsContext } from '../context/MakePlaysContext';
import { groupTicketBetsByNumber } from '@/functions/groupNumber';
import { makeTicketPdf } from '@/functions/makeTicket';



export const PlayDetailsProvider: React.FC<React.PropsWithChildren> = ({ children }) => {
  const { user } = useAuth();

  // ---- state
  const [ticketId, setTicketId] = useState<string | undefined>(undefined);
  const [totalAmount, setTotalAmount] = useState(0);
  const [partialAmount, setPartialAmount] = useState(0);
  const [bets, setBets] = useState<IBetTable[]>([]);
  const [cashier, setCashier] = useState<IUserEntityFront | undefined>(undefined);
  const [lotteries, setLotteries] = useState<Map<string, ILotteryEntityFront>>(new Map());
  const [schedules, setSchedules] = useState<Map<string, IScheduleEntityFront>>(new Map());
  const [selectedIndexes, setSelectedIndexes] = useState<number[]>([]);
  const [userNumber, setUserNumber] = useState<number | undefined>(undefined);
  const [isEnabledCreateBet, setIsEnabledCreateBet] = useState<boolean>(false);

  // ---- fetch cashier por número
  const { data: cashierByNumber } = useGetUserByNumber(userNumber);
  React.useEffect(() => {
    if (!userNumber) setCashier(undefined);
    if (cashierByNumber) setCashier(cashierByNumber);
  }, [userNumber, cashierByNumber]);

  // ---- mutations
  const { mutate: createTicket } = useCreateTicket();
  const { mutate: editTicket } = useEditTicket();

  // ---- @helpers
  const computeTotal = useCallback((list: IBetTable[]) => {
    return list.reduce((acc, bet) => {
      const combos = bet.scheduleLottery.reduce((s, it) => s + it.lotteries.length, 0);
      const amount = typeof bet.amount === 'string' ? parseFloat(bet.amount as any) : (bet.amount ?? 0);
      return acc + amount * combos;
    }, 0);
  }, []);

  const handleRecreateBet = useCallback((values: IBetTable[]) => {
    setBets(values);
    const total = computeTotal(values);
    setPartialAmount(total);
    setTotalAmount(total);
    setSelectedIndexes([]);
    setIsEnabledCreateBet(true);
  }, [computeTotal]);

  const handleCreateBet = useCallback(() => {
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

    // Crear
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

            // reset
            setBets([]);
            setPartialAmount(0);
            setTotalAmount(0);
            setCashier(undefined);
            setLotteries(new Map());
            setSchedules(new Map());
            setUserNumber(undefined);
            setSelectedIndexes([]);
            setTicketId(undefined);
            toast.success('Ticket creado correctamente');
            setIsEnabledCreateBet(true);
          },
          onError: (err) => {
            console.error(err);
            toast.error('Ocurrió un error, intente de nuevo');
            setIsEnabledCreateBet(true);
          },
        }
      );
      return;
    }

    // Editar
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
          setSelectedIndexes([]);
          setTicketId(undefined);
          toast.success('Ticket modificado correctamente');
          setIsEnabledCreateBet(true);
        },
        onError: (err) => {
          console.error(err);
          toast.error('Ocurrió un error al modificar el ticket, intente de nuevo');
          setIsEnabledCreateBet(true);
        },
      }
    );
  }, [bets, cashier, createTicket, editTicket, ticketId, user]);

  const handleEditTicket = useCallback((ticket: ITicketEntityFront) => {
    setTicketId(ticket.ticket_id);
    setSelectedIndexes([]);
    setTotalAmount(0);
    setPartialAmount(0);

    const groupedBets = groupTicketBetsByNumber(ticket);
    setBets(groupedBets);

    const total = groupedBets.reduce((acc, b) => {
      const lotCount = b.scheduleLottery.reduce((c, s) => c + s.lotteries.length, 0);
      const amount = typeof b.amount === 'string' ? parseFloat(b.amount as any) : (b.amount ?? 0);
      return acc + amount * lotCount;
    }, 0);
    setTotalAmount(total);
  }, []);

  const handleResetBets = useCallback(() => {
    setBets([]);
    setPartialAmount(0);
    setTotalAmount(0);
  }, []);

  const handleDeleteSelectedBets = useCallback(() => {
    if (selectedIndexes.length === 0) return;

    let reduction = 0;
    const updatedBets = bets.filter((bet, idx) => {
      if (selectedIndexes.includes(idx)) {
        reduction += bet.amount * bet.scheduleLottery.reduce((acc, s) => acc + s.lotteries.length, 0);
        return false;
      }
      return true;
    });

    setBets(updatedBets);
    setPartialAmount((prev) => prev - reduction);
    setTotalAmount((prev) => prev - reduction);
    setSelectedIndexes([]);
  }, [bets, selectedIndexes]);

  const isEnabledCreateBetByAdmin = useMemo(
    () => (user?.user_type !== USER_TYPE.CASHIER && !!cashier) || user?.user_type === USER_TYPE.CASHIER,
    [cashier, user?.user_type]
  );

  const value: Ctx = {
    // state
    ticketId,
    totalAmount,
    partialAmount,
    bets,
    cashier,
    lotteries,
    schedules,
    selectedIndexes,
    userNumber,
    isEnabledCreateBet,
    // derived
    isEnabledCreateBetByAdmin,
    // actions
    setUserNumber,
    setSelectedIndexes,
    setLotteries,
    setSchedules,
    setIsEnabledCreateBet,
    handleRecreateBet,
    handleCreateBet,
    handleEditTicket,
    handleResetBets,
    handleDeleteSelectedBets,
  };

  return <PlayDetailsContext.Provider value={value}>{children}</PlayDetailsContext.Provider>;
}; */