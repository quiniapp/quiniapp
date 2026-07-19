import { IBetTable, ILotterySchedule } from '@helper/request/ticket.request';
import { ILotteryEntityFront } from '@helper/types/lottery.type';
import { IScheduleEntityFront } from '@helper/types/schedule.type';
import { IUserEntityFront, USER_TYPE } from '@helper/types/user.type';
import dayjs from 'dayjs';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import toast from 'react-hot-toast';
import { useSearchParams } from 'react-router-dom';
import { dateRegex } from '@helper/functions/dateRegex';

import { useAuth } from '@/contexts/AuthContext';
import { makeTicketPdf, printPdfBlob, sharePdfBlob } from '@/functions/makeTicket';
import { useGetGroupedBetsByTicketId } from '@/hooks/fetchs/tickets/useGetGroupedBetsByTicketId';
import { useGetUserByNumber } from '@/hooks/fetchs/users/useUsersByNumber';
import { useEditTicket } from '@/hooks/mutations/tickets/useEditTicket';
import { useCreateTicket } from '@/hooks/mutations/tickets/useTicket';
import { useClockFunctions } from '@/providers/ClockProvider';

import { MakePlaysContext, MakePlaysContextType } from '../context/MakePlaysContext';


export const MakePlaysProvider: React.FC<React.PropsWithChildren> = ({ children }) => {
  const { user } = useAuth();
  const { isScheduleEnabled } = useClockFunctions();
  const [searchParams] = useSearchParams();

  // Fecha del ticket: roles no-cajero pueden backdatear via query param `date`.
  // Cajeros y valores inválidos/futuros caen a hoy (el server re-valida igual).
  const getEffectiveDate = useCallback(() => {
    const today = dayjs().format('YYYY-MM-DD');
    if (user?.user_type === USER_TYPE.CASHIER) return today;
    const rawDate = searchParams.get('date');
    if (rawDate && dateRegex.test(rawDate) && !dayjs(rawDate).isAfter(dayjs(), 'day')) {
      return rawDate;
    }
    return today;
  }, [searchParams, user?.user_type]);

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
  const [isEnabledCreateBet, setIsEnabledCreateBet] = useState<boolean>(true);
  const [openDeleteModal, setOpenDeleteModal] = useState<boolean>(false);
  const [openClosedSchedulesModal, setOpenClosedSchedulesModal] = useState<boolean>(false);
  const [closedSchedules, setClosedSchedules] = useState<IScheduleEntityFront[]>([]);

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

  // Detecta schedules cerrados o por cerrar (menos de 10 minutos) en las bets
  const detectClosedSchedules = useCallback((betsToCheck: IBetTable[]): IScheduleEntityFront[] => {
    const closedSchedulesSet = new Set<string>();
    const closedSchedulesList: IScheduleEntityFront[] = [];

    betsToCheck.forEach((bet) => {
      bet.scheduleLottery.forEach((sl) => {
        // Si el schedule no está habilitado (cerrado o por cerrar)
        if (!isScheduleEnabled(sl.schedule.time) && !closedSchedulesSet.has(sl.schedule.schedule_id)) {
          closedSchedulesSet.add(sl.schedule.schedule_id);
          closedSchedulesList.push(sl.schedule);
        }
      });
    });

    return closedSchedulesList;
  }, [isScheduleEnabled]);

  // Limpia schedules cerrados de las bets y retorna las bets actualizadas
  const cleanClosedSchedulesFromBets = useCallback((betsToClean: IBetTable[]): IBetTable[] => {
    const cleanedBets: IBetTable[] = [];

    betsToClean.forEach((bet) => {
      // Filtrar solo los scheduleLottery que tienen schedules habilitados
      const validScheduleLottery = bet.scheduleLottery.filter((sl) =>
        isScheduleEnabled(sl.schedule.time)
      );

      // Si quedan scheduleLottery válidos, agregar la bet con esos schedules
      if (validScheduleLottery.length > 0) {
        cleanedBets.push({
          ...bet,
          scheduleLottery: validScheduleLottery,
        });
      }
    });

    return cleanedBets;
  }, [isScheduleEnabled]);

  // Keep a ref to latest bets so the interval below doesn't need bets as a dep
  const betsRef = useRef(bets);
  useEffect(() => { betsRef.current = bets; }, [bets]);

  // Mutex: prevents duplicate ticket creation from rapid double-clicks / Enter key.
  // useRef updates synchronously unlike useState, so the guard works within the same event.
  const isSubmittingRef = useRef(false);

  // Idempotency key: generated once per ticket session, cleared on success/reset.
  // Using a ref (not state) so it updates synchronously without triggering re-renders.
  const clientRequestIdRef = useRef<string | undefined>(undefined);

  // Auto-clean closed-schedule bets every 10s for CASHIERs
  useEffect(() => {
    if (user?.user_type !== USER_TYPE.CASHIER) return;

    const id = window.setInterval(() => {
      const prev = betsRef.current;
      if (prev.length === 0) return;
      const cleaned = cleanClosedSchedulesFromBets(prev);
      if (cleaned.length === prev.length) return;
      const newTotal = computeTotal(cleaned);
      setBets(cleaned);
      setTotalAmount(newTotal);
      setPartialAmount(newTotal);
    }, 10_000);

    return () => clearInterval(id);
  }, [user?.user_type, cleanClosedSchedulesFromBets, computeTotal]);


  const handleRecreateBet = useCallback(
    (values: IBetTable[]) => {
      setBets(values);
      const total = computeTotal(values);
      setPartialAmount(total);
      setTotalAmount(total);
      setSelectedIndexes([]);
      setIsEnabledCreateBet(true);
      clientRequestIdRef.current = undefined;  // will be generated on next submit
    },
    [computeTotal]
  );

  const handleCreateBet = useCallback(() => {
    if (isSubmittingRef.current) return;

    // Generate a stable idempotency key for this session if not yet set
    if (!clientRequestIdRef.current) {
      clientRequestIdRef.current = crypto.randomUUID();
    }

    // Solo validar schedules cerrados para cashiers
    if (user?.user_type === USER_TYPE.CASHIER) {
      const closed = detectClosedSchedules(bets);
      if (closed.length > 0) {
        setClosedSchedules(closed);
        setOpenClosedSchedulesModal(true);
        return;
      }
    }

    isSubmittingRef.current = true;
    setIsEnabledCreateBet(false);

    const payload = {
      date: getEffectiveDate(),
      user_id: cashier?.user_id ?? user!.user_id,
      user_name: `${cashier?.name ?? user!.name}-${cashier?.number ?? user!.number}`,
      user_number: cashier?.number ?? user!.number,
      bets: bets,
      client_request_id: clientRequestIdRef.current,
    };

    if (!ticketId) {
      createTicket(payload, {
        onSuccess: async (res) => {
          const lastTicket = {
            bets: [...bets].reverse(),
            ticket: res,
            cashier_number: user?.number ?? undefined,
          };

          // 1. Limpiar estado inmediatamente — el botón queda deshabilitado
          //    por totalAmount=0 independientemente de lo que pase con el PDF.
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
          isSubmittingRef.current = false;
          clientRequestIdRef.current = undefined;
          setIsEnabledCreateBet(true);
          toast.success('Ticket creado correctamente');

          // 2. Generar e imprimir/compartir PDF (puede tardar; si falla no afecta el estado)
          if (user?.user_type === USER_TYPE.CASHIER) {
            const pdfToast = toast.loading('Generando comprobante...');
            try {
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
            } catch {
              toast.error('No se pudo generar el comprobante. Usá "Reimprimir" para intentarlo de nuevo.');
            } finally {
              toast.dismiss(pdfToast);
            }
          }
        },
        onError: (err) => {
          console.error(err);
          toast.error('Ocurrió un error, intente de nuevo');
          isSubmittingRef.current = false;
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
            clientRequestIdRef.current = undefined;
            toast.success('Ticket modificado correctamente');
            isSubmittingRef.current = false;
            setIsEnabledCreateBet(true);
          },
          onError: (err) => {
            console.error(err);
            toast.error('Ocurrió un error al modificar el ticket, intente de nuevo');
            isSubmittingRef.current = false;
            setIsEnabledCreateBet(true);
          },
        }
      );
    }
  }, [bets, cashier, createTicket, editTicket, ticketId, user, detectClosedSchedules, getEffectiveDate]);

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
    clientRequestIdRef.current = undefined;
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

  // Maneja la confirmación del modal de schedules cerrados
  const handleConfirmClosedSchedules = useCallback(() => {
    // Limpiar schedules cerrados de las bets
    const cleanedBets = cleanClosedSchedulesFromBets(bets);

    // Calcular el nuevo total
    const newTotal = computeTotal(cleanedBets);

    // Actualizar estados
    setBets(cleanedBets);
    setTotalAmount(newTotal);
    setPartialAmount(newTotal);

    // Cerrar el modal
    setOpenClosedSchedulesModal(false);
    setClosedSchedules([]);

    // Si no quedan bets después de limpiar, mostrar mensaje
    if (cleanedBets.length === 0) {
      toast.error('No quedan jugadas válidas después de eliminar los turnos cerrados');
      return;
    }

    // Proceder con el cierre del ticket
    if (isSubmittingRef.current) return;
    isSubmittingRef.current = true;
    if (!clientRequestIdRef.current) {
      clientRequestIdRef.current = crypto.randomUUID();
    }
    setIsEnabledCreateBet(false);

    const payload = {
      date: getEffectiveDate(),
      user_id: cashier?.user_id ?? user!.user_id,
      user_name: `${cashier?.name ?? user!.name}-${cashier?.number ?? user!.number}`,
      user_number: cashier?.number ?? user!.number,
      bets: cleanedBets,
      client_request_id: clientRequestIdRef.current,
    };

    if (!ticketId) {
      createTicket(payload, {
        onSuccess: async (res) => {
          const lastTicket = {
            bets: [...cleanedBets].reverse(),
            ticket: res,
            cashier_number: user?.number ?? undefined,
          };

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
          isSubmittingRef.current = false;
          clientRequestIdRef.current = undefined;
          setIsEnabledCreateBet(true);
          toast.success('Ticket creado correctamente');

          if (user?.user_type === USER_TYPE.CASHIER) {
            const pdfToast = toast.loading('Generando comprobante...');
            try {
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
            } catch {
              toast.error('No se pudo generar el comprobante. Usá "Reimprimir" para intentarlo de nuevo.');
            } finally {
              toast.dismiss(pdfToast);
            }
          }
        },
        onError: (err) => {
          console.error(err);
          toast.error('Ocurrió un error, intente de nuevo');
          isSubmittingRef.current = false;
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
            clientRequestIdRef.current = undefined;
            toast.success('Ticket modificado correctamente');
            isSubmittingRef.current = false;
            setIsEnabledCreateBet(true);
          },
          onError: (err) => {
            console.error(err);
            toast.error('Ocurrió un error al modificar el ticket, intente de nuevo');
            isSubmittingRef.current = false;
            setIsEnabledCreateBet(true);
          },
        }
      );
    }
  }, [
    bets,
    cashier,
    user,
    ticketId,
    cleanClosedSchedulesFromBets,
    computeTotal,
    createTicket,
    editTicket,
    getEffectiveDate,
  ]);

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
      openClosedSchedulesModal,
      closedSchedules,
      setBets,
      setTotalAmount,
      setPartialAmount,
      setOpenDeleteModal,
      setOpenClosedSchedulesModal,
      setClosedSchedules,
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
      handleConfirmClosedSchedules,
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
      openClosedSchedulesModal,
      closedSchedules,
      isEnabledCreateBetByAdmin,
      handleRecreateBet,
      handleCreateBet,
      handleEditTicket,
      handleResetBets,
      handleDeleteSelectedBets,
      handleConfirmClosedSchedules,
    ]
  );

  return <MakePlaysContext.Provider value={value}>{children}</MakePlaysContext.Provider>;
};
