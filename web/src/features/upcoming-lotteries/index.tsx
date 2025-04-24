import { useState } from 'react';
import { useForm, Controller  } from 'react-hook-form';
import Box from '@/components/box';
import { Flex } from '@/components/flex';
import HeaderSection from '@/components/header-section';
import { Button } from '@/components/ui/button.tsx';
import { Checkbox } from '@/components/ui/checkbox.tsx';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select.tsx';
import { Calendar, Clock, Ticket } from 'lucide-react';
import { Label } from '@/components/ui/label.tsx';
import { Typography } from '@/components/typography';
import { MODALIDADES } from '@/constants/LIstCommonBets.ts';

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

  const quinielas = [
    ['Nacional', 'Entre Rios', 'Santiago', 'Salta'],
    ['Provincia', 'Mendoza', 'Jujuy', 'Chaco'],
    ['Santa Fe', 'Corrientes', 'Neuquen', 'Tucuman'],
    ['Montevideo', 'Cordoba', 'San Luis', 'Chubut'],
    ['Formosa', 'Misiones', 'Catamarca', 'San Juan'],
    ['Indefinida 1', 'Indefinida 2', '', ''],
  ];

  const dias = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];

  const onSubmit = (data: FormData) => {
    setSavedData(data);
    console.log('Datos guardados:', data);
   //!TODO @Get real data
  };

  return (
    <Box className={'grid grid-rows-[auto_1fr_auto] h-full '}>
      <HeaderSection title={'Quinielas a jugarse'} className={'w-full sticky top-0'} />
      <form onSubmit={handleSubmit(onSubmit)}>
        <Flex>
          <div className=" rounded-xl w-full overflow-hidden py-[24px] space-y-6">
            <div className="  rounded-xl p-4 space-y-4">
              <div className="bg-dark-light rounded-xl space-y-6">
                <div className="space-y-6">
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
                  <Box className={'grid grid-cols-2'}></Box>
                  <div className="border bg-[var(--bg-card)] rounded-lg px-4 py-8">
                    <Flex className={'gap-2 pb-4 items-center mb-8'}>
                      <Clock className={'text-primary'} size={'20px'} />
                      <p className="text-sm font-medium ">Turno Seleccionado</p>
                    </Flex>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      {MODALIDADES.map((turno) => (
                        <div key={turno.value} className="flex items-center space-x-2">
                          <Controller
                            name="turns"
                            control={control}
                            render={({ field }) => (
                              <Checkbox
                                id={turno.value}
                                className={'border-2 border-primary'}
                                checked={field.value.includes(turno.value)}
                                onCheckedChange={(checked) => {
                                  field.onChange(
                                    checked
                                      ? [...field.value, turno.value]
                                      : field.value.filter((v) => v !== turno.value)
                                  );
                                }}
                              />
                            )}
                          />
                          <Label
                            htmlFor={turno.value}
                            className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                          >
                            {turno.label}
                          </Label>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="border bg-[var(--bg-card)] rounded-lg px-4 py-8">
                    <Flex className={'gap-2 items-center mb-8 pb-4'}>
                      <Ticket className={'text-primary'} size={'20px'} />
                      <p className="text-sm font-medium mp">Quinielas</p>
                    </Flex>

                    <div className="grid grid-cols-1 gap-4">
                      {quinielas.map((row, rowIndex) => (
                        <div key={rowIndex} className="grid grid-cols-2 md:grid-cols-4 gap-4">
                          {row.map(
                            (quiniela, index) =>
                              quiniela && (
                                <div
                                  key={`${rowIndex}-${index}`}
                                  className="flex items-center space-x-2"
                                >
                                  <Controller
                                    name="quinielas"
                                    control={control}
                                    render={({ field }) => (
                                      <Checkbox
                                        id={`quiniela-${rowIndex}-${index}`}
                                        className={'border-2 border-primary'}
                                        checked={field.value.includes(quiniela)}
                                        onCheckedChange={(checked) => {
                                          field.onChange(
                                            checked
                                              ? [...field.value, quiniela]
                                              : field.value.filter((v) => v !== quiniela)
                                          );
                                        }}
                                      />
                                    )}
                                  />
                                  <Label
                                    htmlFor={`quiniela-${rowIndex}-${index}`}
                                    className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                                  >
                                    {quiniela}
                                  </Label>
                                </div>
                              )
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                  <Flex>
                    <Button type="submit" variant={'default'} className=" w-[200px]   hover:bg-dark text-white">
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