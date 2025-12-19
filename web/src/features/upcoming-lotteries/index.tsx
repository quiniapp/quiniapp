import { Calendar, Clock, SaveIcon, Ticket } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';

import Box from '@/components/box';
import { Flex } from '@/components/flex';
import HeaderSection from '@/components/header-section';
import HeaderTitleSection from '@/components/header-title-section';
import { Text } from '@/components/atoms/Text';
import { Button } from '@/components/ui/button.tsx';
//import { Checkbox } from '@/components/ui/checkbox.tsx';

import { useMediaQuery } from '@/hooks/useMediaQuery';
import { LotteryCheckboxList } from '@/features/upcoming-lotteries/lottery-checkbox-list';
import { ScheduleRadioList } from '@/features/upcoming-lotteries/schedules-list.tsx';
import { DayRadioList } from '@/features/upcoming-lotteries/day-radio-list.tsx';
import { useSaveScheduleLottery } from '@/hooks/mutations/schedule-lottery/useSaveScheduleLottery';
import { useScheduleLottery } from '@/hooks/fetchs/schedule-lottery/useScheduleLottery';
import { DayKey } from '@helper/types/schedule-lottery.type';

type DayMap = Partial<Record<DayKey, Record<string, string[]>>>;
const UpcomingLotteriesContent = () => {
  const [savedData, setSavedData] = useState<DayMap>({});
  const { mutate: saveScheduleLottery, isPending: isPendingSave } = useSaveScheduleLottery();
  const { data: scheduleLottery, isPending } = useScheduleLottery();

  const [selectedDay, setSelectedDay] = useState<DayKey | ''>('');
  const [selectedSchedule, setSelectedSchedule] = useState<string>('');

  // Toggle SIEMPRE (agrega si no está; quita si está)
  const handleLotteries = (id: string) => {
    if (!selectedDay || !selectedSchedule) return;

    setSavedData((prev) => {
      const dayMap = prev[selectedDay] ?? {};
      const current = dayMap[selectedSchedule] ?? [];
      const next = current.includes(id) ? current.filter((x) => x !== id) : [...current, id];

      return {
        ...prev,
        [selectedDay]: {
          ...dayMap,
          [selectedSchedule]: next,
        },
      };
    });
  };
  const handleSave = () => {
    saveScheduleLottery(savedData);
  };

  const handleSchedule = useCallback(
    (id: string) => {
      setSelectedSchedule(id);
    },
    [selectedDay]
  );

  const handleDay = (day: DayKey) => {
    setSelectedDay(day);
    setSelectedSchedule('');
  };
  useEffect(() => {
    if (scheduleLottery) setSavedData(scheduleLottery);
  }, [isPending]);
  return (
    <Box className={'grid grid-rows-[auto_1fr_auto] h-full '}>
      <HeaderSection title={'Quinielas a jugarse'} className={'w-full sticky top-0'} />

      <Flex>
        <div className=" rounded-xl w-full overflow-hidden py-[16px] space-y-6">
          <div className="rounded-xl p-4 space-y-4">
            <div className="bg-dark-light rounded-xl space-y-6">
              <div className="space-y-6">
                <div className="border bg-card rounded-lg px-4 py-4 1440:py-8">
                  <HeaderTitleSection
                    title={'Día'}
                    icon={<Calendar size={useMediaQuery('(min-width: 1440px)') ? '24px' : '16px'} />}
                    size={useMediaQuery('(min-width: 1440px)') ? 'lg' : 'sm'}
                    className={'!mb-[36px]'}
                  />

                  <DayRadioList selectedDay={selectedDay} handleDay={handleDay} />
                </div>

                <div className="border bg-card rounded-lg px-4 py-4 1440:py-8">
                  <HeaderTitleSection
                    title={'Turno Seleccionado'}
                    icon={<Clock size={useMediaQuery('(min-width: 1440px)') ? '24px' : '16px'} />}
                    size={useMediaQuery('(min-width: 1440px)') ? 'lg' : 'sm'}
                    className={'!mb-[36px]'}
                  />

                  <ScheduleRadioList
                    selectedSchedule={selectedSchedule}
                    handleSchedule={handleSchedule}
                  />
                </div>

                <div className="border bg-card rounded-lg px-4 py-4 1440:py-8">
                  <HeaderTitleSection
                    title={'Quinielas'}
                    icon={<Ticket size={useMediaQuery('(min-width: 1440px)') ? '24px' : '16px'} />}
                    size={useMediaQuery('(min-width: 1440px)') ? 'lg' : 'sm'}
                    className={'!mb-[36px]'}
                  />

                  <LotteryCheckboxList
                    selectedDay={selectedDay}
                    selectedSchedule={selectedSchedule}
                    lotteries={
                      selectedDay && selectedSchedule
                        ? (savedData?.[selectedDay]?.[selectedSchedule] ?? [])
                        : []
                    }
                    onChange={handleLotteries}
                  />
                </div>
                <Flex>
                  <Button
                    type="submit"
                    variant={'default'}
                    className=" w-[200px]   hover:bg-dark text-white"
                    onClick={handleSave}
                  >
                    <SaveIcon />
                    {isPendingSave ? 'Guardando...' : 'Guardar'}
                  </Button>
                </Flex>
              </div>
            </div>
          </div>
        </div>
      </Flex>
    </Box>
  );
};

export default UpcomingLotteriesContent;
