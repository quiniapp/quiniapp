import dayjs from 'dayjs';
import React, { Suspense } from 'react';
import { PencilIcon, SaveIcon, TrashIcon } from 'lucide-react';

import Box from '@/components/box';
import { Flex, FlexCol } from '@/components/flex';
import HeaderSection from '@/components/header-section';

import { Input } from '@/components/ui/input';

import { SelectDayToSearch } from '@/components/button/SelectDayToSearch';
import { IconButton } from '@/components/button/IconButton';
import QuiniChecks from '@/features/results/quini-check';
import ResultShifts from '@/features/results/shifts';

import { useAuth } from '@/contexts/AuthContext';
import { USER_TYPE } from '@helper/types/user.type';
import { PageWrapper } from '@/components/wrapper/PageWrapper';
import { ResultsProvider } from './provider/ResultsProvider';
import { useResults } from './context/ResultsContext';

const ResultsContent = () => {
  const { role } = useAuth();
  const {
    results,
    setResults,
    selectedSchedule,
    selectedLottery,
    selectedDate,
    setSelectedDate,
    setScheduleWinners,
    isOpen,
    setIsOpen,
    isOpenDeleteResult,
    setIsOpenDeleteResult,
    onEdit,
    setOnEdit,
    fetchSchedules,
    lotteries,
    getResults,
    isPending,
    isPendingResults,
    isPendingWinners,
    isPendingDeleteResults,
    inputRefs,
    handleSave,
    handleGenerate,
    handleDeleteResult,
    canSave,
  } = useResults();

  return (
    <PageWrapper>
      <HeaderSection title={'Resultados'} />
      <FlexCol className="w-full gap-1 xl:gap-3 p-1 items-center  max-h-[60px] justify-between">
        <Flex className="w-full  items-center  max-h-[60px] justify-between">
          <SelectDayToSearch
            onDayChange={(date) => {
              setSelectedDate(dayjs(date).format('YYYY-MM-DD'));
            }}
          />
          {role !== USER_TYPE.CASHIER && (
            <Flex className={'gap-6'}>
              <IconButton
                variant="success"
                label={isPendingWinners ? 'Generando...' : 'Generar Ganadores'}
                onClick={() => setIsOpen(true)}
                className="hover:bg-green-700 text-white"
              />
            </Flex>
          )}
        </Flex>
        <FlexCol className="w-full 2xl:flex-row  gap-2 xl:gap-4  justify-center  2xl:gap-6 ">
          <FlexCol className="sm:flex-row 2xl:flex-col justify-between gap-2 xl:gap-3 2xl:gap-6 ">
            <ResultShifts />
            <QuiniChecks />
          </FlexCol>
          <FlexCol className='gap-1 xl:gap-2 2xl:h-full  2xl:gap-6 '>
            <Box className="grid grid-flow-col grid-rows-10 sm:grid-rows-5 gap-1 md:gap-2  p-1 xl:p-2 2xl:p-4 justify-between bg-card rounded h-full">
              {results.map((value, i) => (
                <Flex key={i} className="flex items-center gap-2 2xl:gap-4">
                  <span className="text-xs sm:text-base xl:text-lg 2xl:text-xl text-primary font-bold w-6">
                    {i + 1}
                  </span>
                  <Input
                    ref={(el) => {
                      inputRefs.current[i] = el;
                    }}
                    type="text"
                    inputMode="numeric"
                    maxLength={4}
                    value={value}
                    onChange={(e) => {
                      // Only allow numbers 0-9
                      const numericValue = e.target.value.replace(/[^0-9]/g, '');
                      setResults((prev) => {
                        const newResults = [...prev];
                        newResults[i] = numericValue;
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
                    className="w-full text-xs sm:text-base xl:text-lg  font-semibold xl:font-bold min-w-[60px] sm:min-w-[70px] bg-card-foreground border border-dark-lighter text-white rounded px-2 py-1 text-center 2xl:h-10"
                  />
                </Flex>
              ))}
            </Box>
            {role !== USER_TYPE.CASHIER && (
              <Box className=" grid grid-cols-1 sm:grid-cols-3 p-1   gap-2 w-full sm:w-auto ">
                <IconButton
                  variant="destructive"
                  icon={<TrashIcon />}
                  label="Borrar resultado"
                  disabled={!(selectedLottery && selectedSchedule && getResults?.results_id)}
                  onClick={() => setIsOpenDeleteResult(true)}
                  className="hover:bg-[var(--bg-card)] text-dark font-medium"
                />
                <IconButton
                  variant="outline"
                  icon={<PencilIcon />}
                  label="Editar"
                  onClick={() => setOnEdit(!onEdit)}
                  className="bg-cyan hover:bg-[var(--bg-card)] text-dark font-medium"
                />
                <IconButton
                  variant="default"
                  icon={<SaveIcon />}
                  label={isPending || isPendingResults ? 'Guardando' : 'Guardar Resultados'}
                  onClick={handleSave}
                  disabled={!canSave}
                  className="text-white"
                />
              </Box>
            )}
          </FlexCol>
        </FlexCol>
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
    </PageWrapper>
  );
};

const ResultsContentWithProvider = () => (
  <ResultsProvider>
    <ResultsContent />
  </ResultsProvider>
);

export default ResultsContentWithProvider;

const GenerateWinnersModal = React.lazy(
  () => import('../../../src/components/modals/generate-winners-modal')
);

const DeleteResultsModal = React.lazy(
  () => import('../../../src/components/modals/DeleteResultsModal')
);
