import { useState } from 'react';

import { Clock, PencilIcon, RefreshCw, SaveIcon, Ticket } from 'lucide-react';
import { Flex } from '@/components/flex';
import { Button } from '@/components/ui/button';

import Box from '@/components/box';
import HeaderSection from '@/components/header-section';
import { Checkbox } from '@/components/ui/checkbox';

import { Input } from '@/components/ui/input.tsx';
import { Label } from '@/components/ui/label.tsx';
import { SelectDayToSearch } from '@/features/plays-and-hits/select-day-to-search.tsx';

const ResultsContent = () => {
  const [resultados, setResultados] = useState<string[]>(Array(20).fill(''));

  const turnos = [
    { id: 'previa', label: 'previa(10:15)', time: '10:15' },
    { id: 'primera', label: 'primera(12:0)', time: '12:00' },
    { id: 'matutina', label: 'matutina(15:0)', time: '15:00' },
    { id: 'vesp', label: 'vesp(18:0)', time: '18:00' },
    { id: 'noche', label: 'noche(21:0)', time: '21:00' },
    { id: 'turno5', label: 'Turno5', time: '' },
  ];

  const quinielas = [
    { id: 'nacional', label: 'Nacional' },
    { id: 'provincia', label: 'Provincia' },
    { id: 'santafe', label: 'Santa Fe' },
    { id: 'entrerios', label: 'Entre Rios' },
    { id: 'cordoba', label: 'Cordoba' },
  ];

  return (
    <Box className={'grid grid-rows-[auto_1fr_auto] h-full  '}>
      <HeaderSection title={'Resultados'}>
        <Flex className="w-full items-center space-x-[56px] justify-end">
          <Flex className={'justify-end  w-full items-center space-x-[24px] '}>
            <span className={'text-sm text-muted-foreground'}> Selecinar fecha</span>
            <SelectDayToSearch />
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
      </HeaderSection>
      <div className=" rounded-xl   py-[24px] space-y-6">
        <div className=" bg-[var(--bg-card)] rounded-xl  p-4 space-y-4">
          <div className="border border-dark-lighter rounded-lg p-4">
            <Flex className={'gap-2 pb-4 items-center mb-8'}>
              <Clock className={'text-primary'} size={'20px'} />
              <p className="text-sm font-medium ">Turno </p>
            </Flex>

            <Box className="grid grid-cols-3 gap-4">
              {turnos.map((turno) => (
                <Flex key={turno.id} className="  items-center space-x-2">
                  <Checkbox id={turno.id} className="border border-primary" />
                  <Label
                    htmlFor={turno.id}
                    className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                  >
                    {turno.label}
                  </Label>
                </Flex>
              ))}
            </Box>
          </div>

          <div className="border border-dark-lighter rounded-lg p-4">
            <Flex className={'gap-2 items-center mb-8 pb-4'}>
              <Ticket className={'text-primary'} size={'20px'} />
              <p className="text-sm font-medium mp">Quinielas</p>
            </Flex>
            <Box className="grid grid-cols-3 gap-4">
              {quinielas.map((quiniela) => (
                <Flex key={quiniela.id} className="  items-center space-x-2">
                  <Checkbox id={quiniela.id} className="border border-primary" />
                  <Label
                    htmlFor={quiniela.id}
                    className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                  >
                    {quiniela.label}
                  </Label>
                </Flex>
              ))}
            </Box>
          </div>

          <div className="border border-dark-lighter rounded-lg p-4 pt-[56px]">
            <h3 className="text-sm font-medium mb-4">Resultados</h3>
            <Box className="grid grid-cols-4 gap-6">
              {Array.from({ length: 20 }, (_, i) => (
                <div key={i} className="flex items-center gap-2">
                  <span className="text-sm font-medium w-6">{i + 1}</span>
                  <Input
                    type="text"
                    value={resultados[i]}
                    onChange={(e) => {
                      const newResultados = [...resultados];
                      newResultados[i] = e.target.value;
                      setResultados(newResultados);
                    }}
                    className="w-full bg-[var(--bg-card)] border border-dark-lighter rounded px-2 py-1"
                  />
                </div>
              ))}
            </Box>
            <div className="flex justify-between mt-6 gap-4">
              <Button
                variant={'outline'}
                className="w-1/2 bg-cyan hover:bg-[var(--bg-card)] text-dark font-medium"
              >
                <PencilIcon /> Editar
              </Button>
              <Button variant={'default'} className="w-1/2   text-white">
                <SaveIcon /> Guardar Resultados
              </Button>
            </div>
          </div>
        </div>
      </div>
    </Box>
  );
};

export default ResultsContent;
