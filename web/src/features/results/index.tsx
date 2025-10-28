import dayjs from 'dayjs';
import React, { Suspense, useEffect, useState } from 'react';
import { Clock, PencilIcon, RefreshCw, SaveIcon, TrashIcon } from 'lucide-react';
import { toast } from 'react-hot-toast';

import Box from '@/components/box';
import { Flex, FlexCol } from '@/components/flex';
import HeaderSection from '@/components/header-section';
import HeaderTitleSection from '@/components/header-title-section';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

import { SelectDayToSearch } from '@/features/plays-and-hits/select-day-to-search';
import QuiniChecks from '@/features/results/quini-check';
import ResultShifts from '@/features/results/shifts';

import { useMediaQuery } from '@/hooks/useMediaQuery';
import { useSchedules } from '@/hooks/fetchs/schedule/useSchedules';
import { useLotteries } from '@/hooks/fetchs/lottery/useLotteries';
import { useResults } from '@/hooks/fetchs/results/useResults';
import { useUpdateResults } from '@/hooks/mutations/results/useUpdateResults.mutation';

import { useCreateResults } from '@/hooks/mutations/results/useCreateresults.mutation';
import { useGenerateWinners } from '@/hooks/mutations/winner/useWinner';
import { useAuth } from '@/contexts/AuthContext';
import { USER_TYPE } from '@helper/types/user.type';
import { useDeleteResults } from '@/hooks/mutations/results/useDeleteResults';

const ResultsContent = () => {
  const { role } = useAuth();
  const [isOpen, setIsOpen] = useState<boolean>(false);
  const [isOpenDeleteResult, setIsOpenDeleteResult] = useState<boolean>(false);
  const [results, setResults] = useState<string[]>(Array(20).fill(''));
  const [selectedSchedule, setSelectedSchedule] = useState<string | undefined>();
  const [scheduleWinners, setScheduleWinners] = useState<string | undefined>(undefined);
  const [selectedLottery, setSelectedLottery] = useState<string | undefined>();
  const [selectedDate, setSelectedDate] = useState<string>(dayjs().format('YYYY-MM-DD'));
  const [onEdit, setOnEdit] = useState(false);
  const { mutate: createResults, isPending: isPendingResults } = useCreateResults();
  const { data: fetchSchedules } = useSchedules();
  const { data: lotteries } = useLotteries();
  const { data: getResults, isSuccess } = useResults({
    lottery_id: selectedLottery,
    schedule_id: selectedSchedule,
    date: selectedDate,
  });
  const { mutate: updateResults, isPending } = useUpdateResults();
  const { mutate: generateWinners, isPending: isPendingWinners } = useGenerateWinners({
    schedule_id: scheduleWinners,
    date: selectedDate,
  });
  const { mutate: deleteResults, isPending: isPendingDeleteResults } = useDeleteResults();
  const inputRefs = React.useRef<(HTMLInputElement | null)[]>([]);

  const handleScheduleSelect = (scheduleId: string) => {
    setSelectedSchedule(scheduleId);
  };

  const handleLotterySelect = (lotteryId: string) => {
    setSelectedLottery(lotteryId);
  };

  const handleGenerate = () => {
    generateWinners(undefined, {
      onSuccess: () => {
        toast.success('Resultados guardados correctamente');
      },
      onError: (error) => {
        toast.error(`Error al guardar: ${error.message}`);
      },
    });
  };

  const handleSave = () => {
    if (!selectedSchedule || !selectedLottery) return;
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

  return (
    <Box className={'grid grid-rows-[auto_1fr_auto] h-full  '}>
      <HeaderSection title={'Resultados'} />
      <FlexCol className="w-full items-center space-x-[36px] max-h-[60px] justify-between">
        <Flex className="w-full  mt-8 items-center space-x-[36px] max-h-[60px] justify-between">
          <Flex className={'  w-full items-center space-x-[24px] '}>
            <span className={'text-sm text-muted-foreground'}> Selecionar fecha</span>
            <SelectDayToSearch
              onDayChange={(date) => {
                setSelectedDate(dayjs(date).format('YYYY-MM-DD'));
              }}
            />
          </Flex>
          <Flex className={'gap-6'}>
            <Button variant="outline" className="flex items-center gap-2">
              <RefreshCw size={16} />
              Actualizar
            </Button>
            {role !== USER_TYPE.CASHIER && (
              <Button
                variant={'success'}
                className="  hover:bg-green-700 text-white"
                onClick={() => setIsOpen(true)}
              >
                {isPendingWinners ? 'Generando...' : 'Generar Ganadores'}
              </Button>
            )}
          </Flex>
        </Flex>
        <Box className="grid grid-cols-1 lg:grid-cols-2  gap-8 py-[36px]  ">
          <FlexCol className="  rounded-xl   space-y-6">
            <ResultShifts
              schedules={fetchSchedules ?? []}
              onScheduleSelect={handleScheduleSelect}
            />
            <QuiniChecks quini={lotteries ?? []} onLotterySelect={handleLotterySelect} />
          </FlexCol>
          <div className=" ">
            <HeaderTitleSection
              title={'Resultados'}
              icon={<Clock size={useMediaQuery('(min-width: 1440px)') ? '24px' : '16px'} />}
              variant={useMediaQuery('(min-width: 1440px)') ? 'large' : 'small'}
              className={'pb-2'}
            />
            <Box className="grid grid-flow-col grid-rows-5 gap-6 p-8 justify-between bg-card">
              {results.map((value, i) => (
                <div key={i} className="flex items-center gap-2">
                  <span className="text-sm text-primary font-medium w-6">{i + 1}</span>
                  <Input
                    ref={(el) => {
                      inputRefs.current[i] = el;
                    }}
                    type="text"
                    inputMode="numeric"
                    maxLength={4}
                    value={value}
                    onChange={(e) => {
                      setResults((prev) => {
                        const newResults = [...prev];
                        newResults[i] = e.target.value;
                        return newResults;
                      });
                    }}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        if (i < results.length - 1) {
                          inputRefs.current[i + 1]?.focus();
                          e.preventDefault(); // Evita el beep en algunos navegadores
                        }
                      }
                    }}
                    disabled={!onEdit}
                    className="w-full bg-card-foreground border border-dark-lighter text-white rounded px-2 py-1"
                  />
                </div>
              ))}
            </Box>
            {role !== USER_TYPE.CASHIER && (
              <Box className=" grid grid-cols-3 py-2 mt-6 gap-[12px] ">
                <Button
                  variant={'destructive'}
                  className="  hover:bg-[var(--bg-card)] text-dark w-full font-medium"
                  disabled={!(selectedLottery && selectedSchedule && getResults?.results_id)}
                  onClick={() => setIsOpenDeleteResult(true)}
                >
                  <TrashIcon /> Borrar resultado
                </Button>
                <Button
                  variant={'outline'}
                  className="  bg-cyan hover:bg-[var(--bg-card)] text-dark w-full font-medium"
                  onClick={() => setOnEdit(!onEdit)}
                >
                  <PencilIcon /> Editar
                </Button>
                <Button
                  variant={'default'}
                  onClick={handleSave}
                  className=" w-full   text-white"
                  disabled={!onEdit}
                >
                  <SaveIcon /> {isPending || isPendingResults ? 'Guardando' : 'Guardar Resultados'}
                </Button>
              </Box>
            )}
          </div>
        </Box>
      </FlexCol>
      <Suspense fallback={<div>Cargando...</div>}>
        <GenerateWinnersModal
          isOpen={isOpen}
          onClose={() => setIsOpen(false)}
          schedules={fetchSchedules ?? []}
          setScheduleWinners={setScheduleWinners}
          onClick={handleGenerate}
          isPendingWinners={isPendingWinners}
        />
        <DeleteResultsModal
          isOpen={isOpenDeleteResult}
          date={selectedDate}
          lottery={lotteries?.find((lot) => lot.lottery_id === selectedLottery)}
          schedule={fetchSchedules?.find((sch) => sch.schedule_id === selectedSchedule)}
          isPendingDelete={isPendingDeleteResults}
          onClick={handleDeleteResult}
          onClose={() => setIsOpenDeleteResult(false)}
        />
      </Suspense>
    </Box>
  );
};

export default ResultsContent;

const GenerateWinnersModal = React.lazy(
  () => import('../../../src/components/modals/generate-winners-modal')
);

const DeleteResultsModal = React.lazy(
  () => import('../../../src/components/modals/DeleteResultsModal')
);
