import { Calendar, Clock, SaveIcon, Ticket } from 'lucide-react';
import { useCallback, useState } from 'react';
import { Controller, useForm } from 'react-hook-form';

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
import { useLotteries } from '@/hooks/useLotteries';
import { useSchedules } from '@/hooks/useSchedules';
import { LotteryCheckboxList } from '@/features/upcoming-lotteries/lottery-checkbox-list';
import { ScheduleRadioList } from '@/features/upcoming-lotteries/schedules-list.tsx';
import { useScheduleLottery } from '@/hooks/fetchs/schedule-lottery/useScheduleLottery';
import { useSearchParams } from 'react-router-dom';
import { IScheduleLotteryEntityFront } from '../../../../helper/types/schedule-lottery.type';
import { dayParseToString, dayDictionary } from '../../../../helper/functions/dayDictionary';
import { da } from 'date-fns/locale';
/* 

  schedules:[
    {schedule_id,
      lotteries:[{lottery_id}]
      day: 1-7?
    }
  ] o un map mejor?

  if selected schedule_id && date
    checked = schedule.lotteries.includes(lottery_id)



*/

const UpcomingLotteriesContent = () => {
  const [savedData, setSavedData] = useState<Record<string, Record<string, string[]>>>({});
  const [selectedDay, setSelectedDay] = useState<string>(''); // 'LUNES'
  const [selectedSchedule, setSelectedSchedule] = useState<string>(''); // 'schedule_id'


  // const isLargeScreen = useMediaQuery('(min-width: 1366px)');
  const handleSchedule = useCallback((id: string) => {
    console.log(id)
    setSelectedSchedule(id);
  },[selectedDay]);

  const handleDay = (day:string)=>{
    setSelectedDay(day)
    setSelectedSchedule('')
  }


  console.log({ selectedDay, selectedSchedule });
  return (
    <Box className={'grid grid-rows-[auto_1fr_auto] h-full '}>
      <HeaderSection title={'Quinielas a jugarse'} className={'w-full sticky top-0'}>
        {/*    <div className="flex flex-col gap-2">
          {!isLargeScreen && (
            <div className="space-y-4">
              <Flex className={'flex-1 items-center gap-4'}>
                <Typography variant={'p'}>Selecionar día</Typography>
                <Flex className={'w-[200px]'}>
                  <Controller
                    name="day"
                    control={control}
                    render={({ field }) => (
                      <Select onValueChange={field.onChange} value={field.value}>
                        <SelectTrigger className="w-full bg-[var(--bg-card)] border-dark-lighter">
                          <SelectValue placeholder="Seleccionar día" />
                        </SelectTrigger>
                        <SelectContent>
                          {dias.map((dia) => (
                            <SelectItem key={dia.toLowerCase()} value={dia.toLowerCase()}>
                              {dia}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    )}
                  />
                </Flex>
              </Flex>
            </div>
          )}
        </div> */}
      </HeaderSection>
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

                  <ScheduleRadioList selectedSchedule={selectedSchedule} handleSchedule={handleSchedule} />
                </div>
                 
                <div className="border bg-card rounded-lg px-4 py-4 1440:py-8">
                  <HeaderTitleSection
                    title={'Quinielas'}
                    icon={<Ticket size={useMediaQuery('(min-width: 1440px)') ? '24px' : '16px'} />}
                    variant={useMediaQuery('(min-width: 1440px)') ? 'large' : 'small'}
                    className={'!mb-[36px]'}
                  />

                  <LotteryCheckboxList
                    lottery={lottery ?? []}
                    name="lottery_id"
                  />
                </div>
                <Flex>
                  <Button
                    type="submit"
                    variant={'default'}
                    className=" w-[200px]   hover:bg-dark text-white"
                  >
                    <SaveIcon />
                    Guardar
                  </Button>
                </Flex>
              </div>
            </div>
          </div>
        </div>
      </Flex>

      {savedData && (
        <div className="mt-4 p-4  rounded-md">
          <Typography variant="h4">Datos Guardados:</Typography>
          <pre>{JSON.stringify(savedData, null, 2)}</pre>
        </div>
      )}
    </Box>
  );
};

export default UpcomingLotteriesContent;
