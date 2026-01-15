import React, { useCallback, useEffect, useMemo, useState } from 'react';
import dayjs from 'dayjs';
import toast from 'react-hot-toast';

import { useAuth } from '@/contexts/AuthContext';
import { useCreateTicket } from '@/hooks/mutations/tickets/useTicket';
import { useEditTicket } from '@/hooks/mutations/tickets/useEditTicket';
import { useGetUserByNumber } from '@/hooks/fetchs/users/useUsersByNumber';
import { IScheduleEntityFront } from '@helper/types/schedule.type';
import { ILotteryEntityFront } from '@helper/types/lottery.type';
import { IUserEntityFront, USER_TYPE } from '@helper/types/user.type';
import { IBetTable, ILotterySchedule } from '@helper/request/ticket.request';
import { MakePlaysContext, MakePlaysContextType } from '../context/MakePlaysContext';
import { makeTicketPdf, printPdfBlob, sharePdfBlob } from '@/functions/makeTicket';
import { useGetGroupedBetsByTicketId } from '@/hooks/fetchs/tickets/useGetGroupedBetsByTicketId';

export const MakePlaysProvider: React.FC<React.PropsWithChildren> = ({ children }) => {
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
  const [openDeleteModal, setOpenDeleteModal] = useState<boolean>(false);

  // ---- fetch cashier por número
  const { data: cashierByNumber } = useGetUserByNumber(userNumber);
  const { data: ticketGroupedBets } = useGetGroupedBetsByTicketId(ticketId);

  useEffect(() => {
    if (!userNumber) {
      setCashier(undefined);
    } else if (cashierByNumber) {
      setCashier(cashierByNumber);
    } else {
      // userNumber existe pero cashierByNumber es undefined/null (usuario no encontrado)
      setCashier(undefined);
    }

    setBets([]);
    setTicketId(undefined);
    setSelectedIndexes([]);
    setTotalAmount(0);
    setPartialAmount(0);
  }, [userNumber, cashierByNumber]);

  useEffect(() => {
    if (ticketGroupedBets) {
      setBets(ticketGroupedBets.bets);
      const total = ticketGroupedBets.bets.reduce((acc: number, b: IBetTable) => {
        return (
          acc +
          b.amount *
            b.scheduleLottery.reduce(
              (quantity: number, ls: ILotterySchedule) => quantity + ls.lotteries.length,
              0
            )
        );
      }, 0);
      setTotalAmount(total);
    }
  }, [ticketGroupedBets]);

  // ---- mutations
  const { mutate: createTicket, isPending: isPendingCreate } = useCreateTicket();
  const { mutate: editTicket, isPending: isPendingEdit } = useEditTicket();

  // ---- @helpers
  const computeTotal = useCallback((list: IBetTable[]) => {
    return list.reduce((acc, bet) => {
      const combos = bet.scheduleLottery.reduce((s, it) => s + it.lotteries.length, 0);
      const amount = typeof bet.amount === 'string' ? parseFloat(bet.amount as any) : (bet.amount ?? 0);
      return acc + amount * combos;
    }, 0);
  }, []);

  const handleRecreateBet = useCallback(
    (values: IBetTable[]) => {
      setBets(values);
      const total = computeTotal(values);
      setPartialAmount(total);
      setTotalAmount(total);
      setSelectedIndexes([]);
      setIsEnabledCreateBet(true);
    },
    [computeTotal]
  );

  const handleCreateBet = useCallback(() => {
    setIsEnabledCreateBet(false);
    const today = dayjs().format('YYYY-MM-DD');

    const payload = {
      date: today,
      user_id: cashier?.user_id ?? user!.user_id,
      user_name: `${cashier?.name ?? user!.name}-${cashier?.number ?? user!.number}`,
      bets: bets,
    };

    if (!ticketId) {
      createTicket(payload, {
        onSuccess: async (res) => {
          const lastTicket = {
            bets: [...bets].reverse(),
            ticket: res,
            cashier_number: user?.number,
          };

          if (user?.user_type === USER_TYPE.CASHIER) {
            const { blob, fileName } = await makeTicketPdf(lastTicket);
            const isMobile = /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);

            try {
              if (isMobile) {
                await sharePdfBlob(blob, fileName, {
                  text: `Ticket ${res.ticket_number}`,
                });
              } else {
                printPdfBlob(blob);
              }
            } catch {
              printPdfBlob(blob);
            }
          }

          localStorage.setItem('lastTicket', JSON.stringify(lastTicket));
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
        },
        onError: (err) => {
          console.error(err);
          toast.error('Ocurrió un error, intente de nuevo');
        },
        onSettled: () => {
          setIsEnabledCreateBet(true);
        },
      });
    } else {
      editTicket(
        { ticket_id: ticketId, bets: payload.bets },
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
          },
          onError: (err) => {
            console.error(err);
            toast.error('Ocurrió un error al modificar el ticket, intente de nuevo');
          },
          onSettled: () => {
            setIsEnabledCreateBet(true);
          },
        }
      );
    }
  }, [bets, cashier, createTicket, editTicket, ticketId, user]);

  const handleEditTicket = useCallback((ticket_id: string) => {
    setTicketId(ticket_id);
    setSelectedIndexes([]);
    setTotalAmount(0);
    setPartialAmount(0);
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

  const value: MakePlaysContextType = useMemo(
    () => ({
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
      isPendingCreate,
      isPendingEdit,
      openDeleteModal,
      setBets,
      setTotalAmount,
      setPartialAmount,
      setOpenDeleteModal,
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
    }),
    [
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
      isPendingCreate,
      isPendingEdit,
      openDeleteModal,
      isEnabledCreateBetByAdmin,
      handleRecreateBet,
      handleCreateBet,
      handleEditTicket,
      handleResetBets,
      handleDeleteSelectedBets,
    ]
  );

  return <MakePlaysContext.Provider value={value}>{children}</MakePlaysContext.Provider>;
};
