import { Calendar, Clock, SaveIcon, Ticket } from 'lucide-react';
import { useState } from 'react';
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
import { ScheduleCheckboxList } from '@/features/upcoming-lotteries/schedules-list.tsx';

interface FormData {
  day: string;
  turns: string[];
  quinielas: string[];
}

const UpcomingLotteriesContent = () => {
  const [savedData, setSavedData] = useState<FormData | null>(null);
  const { handleSubmit, control } = useForm<FormData>({
    defaultValues: {
      day: 'domingo',
      turns: [],
      quinielas: [],
    },
  });

  const { data } = useLotteries();
  const { data: schedulesData } = useSchedules();
  const lottery = data?.data?.lottery ?? [];
  const schedules = schedulesData?.data?.schedule ?? [];

  console.log({
    lottery: lottery,
    schedule: schedules,
  });

  const dias = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];
  const isLargeScreen = useMediaQuery('(min-width: 1440px)');

  const onSubmit = (data: FormData) => {
    setSavedData(data);
    console.log('Datos guardados:', data);
    //!TODO @Get real data
  };

  return (
    <Box className={'grid grid-rows-[auto_1fr_auto] h-full '}>
      <HeaderSection title={'Quinielas a jugarse'} className={'w-full sticky top-0'}>
        <div className="flex flex-col gap-2">
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
        </div>
      </HeaderSection>
      <form onSubmit={handleSubmit(onSubmit)}>
        <Flex>
          <div className=" rounded-xl w-full overflow-hidden py-[16px] space-y-6">
            <div className="rounded-xl p-4 space-y-4">
              <div className="bg-dark-light rounded-xl space-y-6">
                <div className="space-y-6">
                  {useMediaQuery('(min-width: 1440px)') ? (
                    <div className="space-y-4">
                      <div className="flex flex-col gap-2">
                        <Flex className={'gap-2 items-center'}>
                          <Calendar className={'text-primary'} size={'16px'} />
                          <label className="text-md text-gray-200"> Día</label>
                        </Flex>
                        <Flex className={'flex-1 items-center gap-4'}>
                          <Typography variant={'p'}>Selecionar día </Typography>
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
                    </div>
                  ) : (
                    ''
                  )}

                  <div className="border bg-card rounded-lg px-4 py-4 1440:py-8">
                    <HeaderTitleSection
                      title={'Turno Seleccionado'}
                      icon={<Clock size={useMediaQuery('(min-width: 1440px)') ? '24px' : '16px'} />}
                      variant={useMediaQuery('(min-width: 1440px)') ? 'large' : 'small'}
                      className={'!mb-[36px]'}
                    />

                    <ScheduleCheckboxList<FormData>
                      schedules={schedules ?? []}
                      control={control}
                      name="turns"
                    />
                  </div>

                  <div className="border bg-card rounded-lg px-4 py-4 1440:py-8">
                    <HeaderTitleSection
                      title={'Quinielas'}
                      icon={
                        <Ticket size={useMediaQuery('(min-width: 1440px)') ? '24px' : '16px'} />
                      }
                      variant={useMediaQuery('(min-width: 1440px)') ? 'large' : 'small'}
                      className={'!mb-[36px]'}
                    />

                    <LotteryCheckboxList<FormData>
                      lottery={lottery ?? []}
                      control={control}
                      name="quinielas"
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
      </form>

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
