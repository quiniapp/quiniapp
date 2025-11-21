import React, { useEffect, useState } from 'react';
import dayjs from 'dayjs';
import { toast } from 'react-hot-toast';

import { ResultsContext, ResultsContextType } from '../context/ResultsContext';

import { useSchedules } from '@/hooks/fetchs/schedule/useSchedules';
import { useLotteries } from '@/hooks/fetchs/lottery/useLotteries';
import { useResults as useFetchResults } from '@/hooks/fetchs/results/useResults';
import { useUpdateResults } from '@/hooks/mutations/results/useUpdateResults.mutation';
import { useCreateResults } from '@/hooks/mutations/results/useCreateresults.mutation';
import { useGenerateWinners } from '@/hooks/mutations/winner/useWinner';
import { useDeleteResults } from '@/hooks/mutations/results/useDeleteResults';

export const ResultsProvider: React.FC<React.PropsWithChildren> = ({ children }) => {
  // ---- State
  const [isOpen, setIsOpen] = useState<boolean>(false);
  const [isOpenDeleteResult, setIsOpenDeleteResult] = useState<boolean>(false);
  const [results, setResults] = useState<string[]>(Array(20).fill(''));
  const [selectedSchedule, setSelectedSchedule] = useState<string | undefined>();
  const [scheduleWinners, setScheduleWinners] = useState<string | undefined>(undefined);
  const [selectedLottery, setSelectedLottery] = useState<string | undefined>();
  const [selectedDate, setSelectedDate] = useState<string>(dayjs().format('YYYY-MM-DD'));
  const [onEdit, setOnEdit] = useState(false);

  // ---- Refs
  const inputRefs = React.useRef<(HTMLInputElement | null)[]>([]);

  // ---- Fetch data
  const { data: fetchSchedules } = useSchedules();
  const { data: lotteries } = useLotteries();
  const { data: getResults, isSuccess } = useFetchResults({
    lottery_id: selectedLottery,
    schedule_id: selectedSchedule,
    date: selectedDate,
  });

  // ---- Mutations
  const { mutate: createResults, isPending: isPendingResults } = useCreateResults();
  const { mutate: updateResults, isPending } = useUpdateResults();
  const { mutate: generateWinners, isPending: isPendingWinners } = useGenerateWinners({
    schedule_id: scheduleWinners,
    date: selectedDate,
  });
  const { mutate: deleteResults, isPending: isPendingDeleteResults } = useDeleteResults();

  // ---- Handlers
  const handleScheduleSelect = (scheduleId: string) => {
    setSelectedSchedule(scheduleId);
  };

  const handleLotterySelect = (lotteryId: string) => {
    setSelectedLottery(lotteryId);
  };

  const handleGenerate = () => {
    generateWinners(undefined, {
      onSuccess: () => {
        toast.success('Ganadores generados y cuenta corriente actualizada');
      },
      onError: (error) => {
        toast.error(`Error al generar ganadores: ${error.message}`);
      },
    });
  };

  const handleSave = () => {
    if (!selectedSchedule || !selectedLottery) return;

    // Validate that all results have exactly 4 digits
    const allValid = results.every((result) => result.length === 4);
    if (!allValid) {
      toast.error('Todos los resultados deben tener exactamente 4 cifras');
      return;
    }

    const payload = {
      schedule_id: selectedSchedule,
      lottery_id: selectedLottery,
      results: results,
      date: selectedDate,
    };
    if (!getResults?.results?.length) {
      createResults(
        {
          createResults: payload,
        },
        {
          onSuccess: () => {
            toast.success('Resultados guardados correctamente');
          },
          onError: (error) => {
            toast.error(`Error al guardar: ${error.message}`);
          },
        }
      );
    } else {
      updateResults(
        {
          id: getResults?.results_id,
          updateResults: payload,
        },
        {
          onSuccess: () => {
            toast.success('Resultados guardados correctamente');
          },
          onError: (error) => {
            toast.error(`Error al guardar: ${error.message}`);
          },
        }
      );
    }
    setOnEdit(false);
  };

  const handleDeleteResult = () => {
    if (getResults?.results_id)
      deleteResults(
        {
          results_id: getResults?.results_id,
          date: selectedDate,
          lottery_id: selectedLottery ?? '',
          schedule_id: selectedSchedule ?? '',
        },
        {
          onSuccess: () => {
            toast.success('Resultados borrados correctamente');
            setIsOpenDeleteResult(false);
          },
          onError: (error) => {
            toast.error(`Error al borrar: ${error.message}`);
          },
        }
      );
  };

  // ---- Derived state
  const canSave = onEdit && results.every((result) => result.length === 4);

  // ---- Effects
  useEffect(() => {
    if (!isSuccess) return;
    else {
      if (getResults?.results?.length) {
        setResults(getResults.results);
      } else {
        setResults(Array(20).fill(''));
      }
    }
    setOnEdit(false);
  }, [isSuccess, selectedLottery, selectedDate, selectedSchedule, isOpenDeleteResult]);

  const value: ResultsContextType = {
    // State
    results,
    selectedSchedule,
    selectedLottery,
    selectedDate,
    scheduleWinners,
    isOpen,
    isOpenDeleteResult,
    onEdit,
    fetchSchedules,
    lotteries,
    getResults,
    isPending,
    isPendingResults,
    isPendingWinners,
    isPendingDeleteResults,
    isSuccess,
    inputRefs,
    // Setters
    setResults,
    setSelectedSchedule,
    setSelectedLottery,
    setSelectedDate,
    setScheduleWinners,
    setIsOpen,
    setIsOpenDeleteResult,
    setOnEdit,
    // Actions
    handleScheduleSelect,
    handleLotterySelect,
    handleGenerate,
    handleSave,
    handleDeleteResult,
    canSave,
  };

  return <ResultsContext.Provider value={value}>{children}</ResultsContext.Provider>;
};
