import FillOutATicket from '@/features/make-plays/fill-out-a-ticket';
import HeaderPlayDetail from '@/features/make-plays/header-play-detail';
import { useEffect, useState } from 'react';
import ResultsOverview from './results-overview';
import { useCreateTicket } from '@/hooks/mutations/tickets/useTicket';
import PlayDetailGameTable from './play-detail-game-table';
import dayjs from 'dayjs';
import toast from 'react-hot-toast';
import { IUserEntityFront, USER_TYPE } from '@helper/types/user.type';
import { ILotteryEntityFront } from '@helper/types/lottery.type';
import { IScheduleEntityFront } from '@helper/types/schedule.type';
import customParseFormat from 'dayjs/plugin/customParseFormat';
import { useEditTicket } from '@/hooks/mutations/tickets/useEditTicket';
import { useAuth } from '@/contexts/AuthContext';
import { useGetUserByNumber } from '@/hooks/fetchs/users/useUsersByNumber';
import { makeTicketPdf, printPdfBlob, sharePdfBlob } from '@/functions/makeTicket';
import { IBetTable, ILotterySchedule } from '@helper/request/ticket.response';
import { useGetGroupedBetsByTicketId } from '@/hooks/fetchs/tickets/useGetGroupedBetsByTicketId';
import { PageWrapper } from '@/components/wrapper/PageWrapper';

dayjs.extend(customParseFormat);

const MakePlaysContent = () => {
  const { user } = useAuth();
  const [ticketId, setTicketId] = useState<string | undefined>(undefined);
  const [totalAmount, setTotalAmount] = useState<number>(0);
  const [partialAmount, setPartialAmount] = useState<number>(0);
  const [bets, setBets] = useState<IBetTable[]>([]);
  const [cashier, setCashier] = useState<IUserEntityFront | undefined>(undefined);
  const [lotteries, setLotteries] = useState<Map<string, ILotteryEntityFront>>(new Map());
  const [schedules, setSchedules] = useState<Map<string, IScheduleEntityFront>>(new Map());
  const { mutate: createTicket, isPending: isPendingCreate } = useCreateTicket();
  const [selectedIndexes, setSelectedIndexes] = useState<number[]>([]);
  const [userNumber, setUserNumber] = useState<number | undefined>(undefined);
  const { data } = useGetUserByNumber(userNumber);
  const [isEnabledCreateBet, setIsEnabledCreateBet] = useState<boolean>(false);
  const { mutate: editTicket, isPending: isPendingEdit } = useEditTicket();
  const { data: ticketGroupedBets } = useGetGroupedBetsByTicketId(ticketId);
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
            ticket: res.data.ticket,
            cashier_number: user?.number,
          };

          if (user?.user_type === USER_TYPE.CASHIER) {
            // Generar PDF en memoria
            const { blob, fileName } = makeTicketPdf(lastTicket);

            // Heurística simple: si es mobile, priorizo compartir; si desktop, imprimir
            const isMobile = /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);

            try {
              if (isMobile) {
                // 1) Intentá compartir el archivo directamente (Chrome Android)
                await sharePdfBlob(blob, fileName, {
                  text: `Ticket ${res.data.ticket.ticket_number}`,
                });
              } else {
                // Desktop: imprimir directo
                printPdfBlob(blob);
              }
            } catch {
              // Garantizá una salida
              printPdfBlob(blob);
            }
          }
          // 🧠 tu lógica existente
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
  };

  const handleEditTicket = (ticket_id: string) => {
    setTicketId(ticket_id);
    setSelectedIndexes([]);
    setTotalAmount(0);
    setPartialAmount(0);

    // 3) total: similar a RepeatTicketModal (amount * #loterías seleccionadas por jugada)
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
    if (!userNumber) {
      setCashier(undefined);
    }

    if (data) {
      setCashier(data);
    }

    setBets([]);
    setTicketId(undefined);
    setSelectedIndexes([]);
    setTotalAmount(0);
    setPartialAmount(0);
  }, [userNumber, data]);

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

  const isEnabledCreateBetByAdmin =
    (user?.user_type !== USER_TYPE.CASHIER && !!cashier) || user?.user_type === USER_TYPE.CASHIER;

  // 1) Derivado para saber si hay mutación en curso
  const isBusy = isPendingCreate || isPendingEdit;

  // 2) Tu regla de habilitación del botón (sin el or de totalAmount===0)
  const isButtonCloseTicketEnabled = totalAmount > 0 && isEnabledCreateBetByAdmin && !isBusy;

  return (
    <PageWrapper>
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
        isEnabled={isButtonCloseTicketEnabled}
      />
    </PageWrapper>
  );
};

export default MakePlaysContent;
