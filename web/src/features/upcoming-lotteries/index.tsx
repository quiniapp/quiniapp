import { Calendar, Clock, SaveIcon, Ticket } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';

import Box from '@/components/box';
import { Flex } from '@/components/flex';
import HeaderSection from '@/components/header-section';
import HeaderTitleSection from '@/components/header-title-section';
import { Typography } from '@/components/typography';
import { Button } from '@/components/ui/button.tsx';
//import { Checkbox } from '@/components/ui/checkbox.tsx';

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select.tsx';

import { useMediaQuery } from '@/hooks/useMediaQuery';
import { LotteryCheckboxList } from '@/features/upcoming-lotteries/lottery-checkbox-list';
import { ScheduleRadioList } from '@/features/upcoming-lotteries/schedules-list.tsx';
import { dayParseToString, dayDictionary } from '../../../../helper/functions/dayDictionary';
import { useSaveScheduleLottery } from '@/hooks/mutations/schedule-lottery/useSaveScheduleLottery';
import { useScheduleLottery } from '@/hooks/fetchs/schedule-lottery/useScheduleLottery';
import toast from 'react-hot-toast';

const UpcomingLotteriesContent = () => {
  const [savedData, setSavedData] = useState<Record<string, Record<string, string[]>>>({});
  const [selectedDay, setSelectedDay] = useState<string>(''); // 'LUNES'
  const [selectedSchedule, setSelectedSchedule] = useState<string>(''); // 'schedule_id'
  const { mutate: saveScheduleLottery, isPending: isPendingSave } = useSaveScheduleLottery();
  const { data: scheduleLottery, isPending } = useScheduleLottery();
  // const isLargeScreen = useMediaQuery('(min-width: 1366px)');
  const handleSchedule = useCallback(
    (id: string) => {
      setSelectedSchedule(id);
    },
    [selectedDay]
  );

  const handleDay = (day: string) => {
    setSelectedDay(day);
    setSelectedSchedule('');
  };

  const handleLotteries = (id: string) => {
    if (savedData?.[selectedDay]?.[selectedSchedule]?.includes(id)) {
      setSavedData((prevData) => {
        const updatedData = { ...prevData };
        updatedData[selectedDay] = {
          ...updatedData[selectedDay],
          [selectedSchedule]: updatedData[selectedDay][selectedSchedule].filter(
            (lotteryId) => lotteryId !== id
          ),
        };
        return updatedData;
      });
    } else {
      setSavedData((prevData) => {
        const updatedData = { ...prevData };
        updatedData[selectedDay] = {
          ...updatedData[selectedDay],
          [selectedSchedule]: [...(updatedData[selectedDay]?.[selectedSchedule] || []), id],
        };
        return updatedData;
      });
    }
  };
  const handleSave = () => {
    saveScheduleLottery(savedData, {
      onSuccess: () => {
        toast.success('Guardado correctamente');
      },
      onError: () => {
        toast.error('Ocurrió un error, intente de nuevo');
      },
    });
  };
  useEffect(() => {
    setSavedData(scheduleLottery?.scheduleLotteries);
  }, [isPending]);
  return (
    <Box className={'grid grid-rows-[auto_1fr_auto] h-full '}>
      <HeaderSection title={'Quinielas a jugarse'} className={'w-full sticky top-0'} />

      <Flex>
        <div className=" rounded-xl w-full overflow-hidden py-[16px] space-y-6">
          <div className="rounded-xl p-4 space-y-4">
            <div className="bg-dark-light rounded-xl space-y-6">
              <div className="space-y-6">
                <div className="space-y-4">
                  <div className="flex flex-col gap-2">
                    <Flex className={'gap-2 items-center'}>
                      <Calendar className={'text-primary'} size={'16px'} />
                      <label className="text-md text-gray-200"> Día</label>
                    </Flex>
                    <Flex className={'flex-1 items-center gap-4'}>
                      <Typography variant={'p'}>Selecionar día</Typography>
                      <Flex className={'w-[200px]'}>
                        <Select
                          value={selectedDay}
                          onValueChange={(value) => {
                            handleDay(value);
                          }}
                        >
                          <SelectTrigger className="w-full bg-[var(--bg-card)] border-dark-lighter">
                            <SelectValue placeholder="Seleccionar día" />
                          </SelectTrigger>
                          <SelectContent>
                            {dayParseToString.map((dia) => (
                              <SelectItem key={dia.toLowerCase()} value={dia}>
                                {dayDictionary[dia as keyof typeof dayDictionary]}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </Flex>
                    </Flex>
                  </div>
                </div>

                <div className="border bg-card rounded-lg px-4 py-4 1440:py-8">
                  <HeaderTitleSection
                    title={'Turno Seleccionado'}
                    icon={<Clock size={useMediaQuery('(min-width: 1440px)') ? '24px' : '16px'} />}
                    variant={useMediaQuery('(min-width: 1440px)') ? 'large' : 'small'}
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
                    variant={useMediaQuery('(min-width: 1440px)') ? 'large' : 'small'}
                    className={'!mb-[36px]'}
                  />

                  <LotteryCheckboxList
                    selectedDay={selectedDay}
                    selectedSchedule={selectedSchedule}
                    lotteries={savedData?.[selectedDay]?.[selectedSchedule]}
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
