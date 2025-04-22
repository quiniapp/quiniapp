
import { useState } from 'react';
import Box from '@/components/box';
import { Flex } from '@/components/flex';
import HeaderSection from '@/components/header-section';
import { Button } from '@/components/ui/button.tsx';
import { Checkbox } from '@/components/ui/checkbox.tsx';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select.tsx';
import { Calendar, Clock, Ticket } from "lucide-react";

const UpcomingLotteriesContent = () => {

  const [selectedDay, setSelectedDay] = useState<string>('domingo');

  const turnos = [
    { id: 'manana', label: 'Mañana (10:45)' },
    { id: 'turno2', label: 'Turno 2' },
    { id: 'turno3', label: 'Turno 3' },
    { id: 'turno4', label: 'Turno 4' },
    { id: 'turno5', label: 'Turno 5' },
    { id: 'turno6', label: 'Turno 6' },
  ];

  const quinielas = [
    ['Nacional', 'Entre Rios', 'Santiago', 'Salta'],
    ['Provincia', 'Mendoza', 'Jujuy', 'Chaco'],
    ['Santa Fe', 'Corrientes', 'Neuquen', 'Tucuman'],
    ['Montevideo', 'Cordoba', 'San Luis', 'Chubut'],
    ['Formosa', 'Misiones', 'Catamarca', 'San Juan'],
    ['Indefinida 1', 'Indefinida 2', '', ''],
  ];

  const dias = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];


  return (
    <Box className={'grid grid-rows-[auto_1fr_auto] h-full '}>
      <HeaderSection title={'Quinielas a jugarse'} className={'w-full sticky top-0'} />
      <Flex>
        <div className=" rounded-xl w-full  py-[24px] space-y-6">
          <div className=" bg-[var(--bg-card)]  p-4 space-y-4">
            <div className="bg-dark-light rounded-xl p-6 space-y-6">


              <div className="space-y-6">
                <div className="space-y-4">
                  <div className="flex flex-col gap-2">
                    <Flex className={'gap-2 items-center'}>
                      <Calendar className={'text-primary'} size={'16px'} />
                      <label className="text-md text-gray-200"> Día</label>
                    </Flex>
                    <Select defaultValue={selectedDay} onValueChange={setSelectedDay}>
                      <SelectTrigger className="w-full bg-dark border-dark-lighter">
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
                  </div>
                </div>

                <div className="border border-dark-lighter rounded-lg p-4">
                  <Flex className={'gap-2 pb-4 items-center mb-8'}>
                    <Clock className={'text-violet-500'} size={'20px'} />
                    <p className="text-sm font-medium ">Turno Seleccionado</p>
                  </Flex>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    {turnos.map((turno) => (
                      <div key={turno.id} className="flex items-center space-x-2">
                        <Checkbox id={turno.id} />
                        <label
                          htmlFor={turno.id}
                          className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                        >
                          {turno.label}
                        </label>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="border border-dark-lighter rounded-lg p-4">
                  <Flex className={'gap-2 items-center mb-8 pb-4'}>
                    <Ticket className={'text-violet-500'} size={'20px'} />
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
                                <Checkbox id={`quiniela-${rowIndex}-${index}`} />
                                <label
                                  htmlFor={`quiniela-${rowIndex}-${index}`}
                                  className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                                >
                                  {quiniela}
                                </label>
                              </div>
                            )
                        )}
                      </div>
                    ))}
                  </div>
                </div>
                <Flex>
                  <Button variant={'default'} className=" w-[200px]   hover:bg-dark text-white">
                    Guardar
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