import dayjs from 'dayjs';
import { useEffect, useState } from 'react';
import { Clock, PencilIcon, RefreshCw, SaveIcon } from 'lucide-react';
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
import { useSchedules } from '@/hooks/useSchedules';
import { useLotteries } from '@/hooks/useLotteries';
import { useResults } from '@/hooks/fetchs/results/useResults';
import { useUpdateResults } from '@/hooks/mutations/results/useUpdateResults.mutation';

import { IUpdateResultsEntity } from '../../../helper/request/results.response';

interface IResultItem {
  lottery: {
    lottery_id: string;
  };
  schedule: {
    schedule_id: string;
  };
  date: string;
  results_id: string;
  results: string[];
}

const ResultsContent = () => {
  const [results, setResults] = useState<string[]>(Array(20).fill(''));
  const [selectedSchedule, setSelectedSchedule] = useState<string | undefined>();
  const [selectedLottery, setSelectedLottery] = useState<string | undefined>();
  const [selectedDate, setSelectedDate] = useState<string>(dayjs().format('YYYY-MM-DD'));

  const [onEdit, setOnEdit] = useState(true);

  const { data: fetchSchedules } = useSchedules();
  const { data: fetchLotteries } = useLotteries();
  const { data: getResults } = useResults({
    lottery_id: selectedLottery,
    schedule_id: selectedSchedule,
    date: selectedDate,
  });
  const { mutate: updateResults, isPending } = useUpdateResults();

  const schedules = fetchSchedules?.data?.schedule || [];
  const lotteries = fetchLotteries?.data?.lottery || [];

  const result = getResults?.data?.results || [];

  const handleScheduleSelect = (scheduleId: string) => {
    setSelectedSchedule(scheduleId);
  };

  const handleLotterySelect = (lotteryId: string) => {
    setSelectedLottery(lotteryId);
  };

  useEffect(() => {
    if (selectedSchedule !== undefined && selectedLottery !== undefined) {
      const rawResults = getResults?.data?.results.length
        ? getResults?.data?.results[0]
        : undefined;

      if (rawResults) {
        setResults(rawResults);
      } else {
        setResults(Array(20).fill(''));
      }
    }
  }, [getResults?.data?.results, selectedSchedule, selectedLottery]);

  /*
  *  useEffect(() => {
     if (selectedSchedule && selectedLottery) {
       const match = result.find(
         (item: any) =>
           item.lottery.lottery_id === selectedLottery &&
           item.schedule.schedule_id === selectedSchedule
       );

       if (match) {
         setResults(match.results);
       } else {
         setResults(Array(20).fill(''));
       }
     } else {
       setResults(Array(20).fill(''));
     }
   }, [selectedSchedule, selectedLottery, result]);
   * */

  const handleSave = () => {
    if (!selectedSchedule || !selectedLottery) return;

    const today = new Date().toISOString().split('T')[0];

    const typedResults = result as IResultItem[];

    const match = typedResults.find(
      (item) =>
        item.lottery.lottery_id === selectedLottery &&
        item.schedule.schedule_id === selectedSchedule &&
        item.date === selectedDate
    );

    if (!match || !match.results_id) {
      console.error('❌ No se encontró un results_id para actualizar');
      return;
    }

    const updatePayload: IUpdateResultsEntity = {
      schedule_id: selectedSchedule,
      lottery_id: selectedLottery,
      results: results.map((r) => r.trim()),
      date: today,
    };

    updateResults(
      {
        id: match.results_id,
        updateResults: updatePayload,
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
  };
  const normalizedResults = [...results, ...Array(20).fill('')].slice(0, 20);
  return (
    <Box className={'grid grid-rows-[auto_1fr_auto] h-full  '}>
      <HeaderSection title={'Resultados'} />
      <FlexCol className="w-full items-center space-x-[36px] max-h-[60px] justify-between">
        <Flex className="w-full  mt-8 items-center space-x-[36px] max-h-[60px] justify-between">
          <Flex className={'  w-full items-center space-x-[24px] '}>
            <span className={'text-sm text-muted-foreground'}> Selecionar fecha</span>
            <SelectDayToSearch onDayChange={(date) => setSelectedDate(date)} />
          </Flex>
          <Flex className={'gap-6'}>
            <Button variant="outline" className="flex items-center gap-2">
              <RefreshCw size={16} />
              Actualizar
            </Button>
            <Button variant={'success'} className="  hover:bg-green-700 text-white">
              Generar Ganadores
            </Button>
          </Flex>
        </Flex>
        <Box className="grid grid-cols-1 lg:grid-cols-2  gap-8 py-[36px]  ">
          <FlexCol className="  rounded-xl   space-y-6">
            <ResultShifts schedules={schedules} onScheduleSelect={handleScheduleSelect} />
            <QuiniChecks quini={lotteries} onLotterySelect={handleLotterySelect} />
          </FlexCol>
          <div className=" ">
            <HeaderTitleSection
              title={'Resultados'}
              icon={<Clock size={useMediaQuery('(min-width: 1440px)') ? '24px' : '16px'} />}
              variant={useMediaQuery('(min-width: 1440px)') ? 'large' : 'small'}
              className={'pb-2'}
            />
            <Box className="grid grid-cols-4 gap-6 p-8 justify-between bg-card">
              {normalizedResults.map((value, i) => (
                <div key={i} className="flex items-center gap-2">
                  <span className="text-sm text-primary font-medium w-6">{i + 1}</span>
                  <Input
                    type="text"
                    value={value}
                    onChange={(e) => {
                      const newResults = [...normalizedResults];
                      newResults[i] = e.target.value;
                      setResults(newResults);
                    }}
                    disabled={onEdit}
                    className="w-full bg-card-foreground border border-dark-lighter text-white rounded px-2 py-1"
                  />
                </div>
              ))}
            </Box>
            <Box className=" grid grid-cols-2 py-4 mt-6 gap-[24px] ">
              <Button
                variant={'outline'}
                className="  bg-cyan hover:bg-[var(--bg-card)] text-dark w-full font-medium"
                onClick={() => setOnEdit(!onEdit)}
              >
                <PencilIcon /> Editar
              </Button>
              <Button variant={'default'} onClick={handleSave} className=" w-full   text-white">
                <SaveIcon /> {isPending ? 'Guardando' : 'Guardar Results'}
              </Button>
            </Box>
          </div>
        </Box>
      </FlexCol>
    </Box>
  );
};

export default ResultsContent;
