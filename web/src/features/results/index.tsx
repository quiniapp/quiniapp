import { useEffect, useState } from 'react';

import { PencilIcon, RefreshCw, SaveIcon } from 'lucide-react';
import { Flex } from '@/components/flex';
import { Button } from '@/components/ui/button';

import Box from '@/components/box';
import HeaderSection from '@/components/header-section';

import { Input } from '@/components/ui/input.tsx';

import { SelectDayToSearch } from '@/features/plays-and-hits/select-day-to-search.tsx';
import ResultShifts from '@/features/results/shifts.tsx';
import QuiniChecks from '@/features/results/quini-check.tsx';
import { MODALIDADES } from '@/constants/LIstCommonBets.ts';

const ResultsContent = () => {
  const [results, setResults] = useState<string[]>(Array(20).fill(''));
  const [selectedShift, setSelectedShift] = useState<string | null>(null);
  const [selectedQuiniela, setSelectedQuiniela] = useState<string | null>(null);

  const quinielas = [
    { id: 'nacional', label: 'Nacional' },
    { id: 'provincia', label: 'Provincia' },
    { id: 'santafe', label: 'Santa Fe' },
    { id: 'entrerios', label: 'Entre Rios' },
    { id: 'cordoba', label: 'Cordoba' },
  ];
  const handleShiftSelect = (shiftId: string) => {
    setSelectedShift(shiftId);
  };

  const handleQuinielaSelect = (quinielaId: string) => {
    setSelectedQuiniela(quinielaId);
  };

  useEffect(() => {
    if (selectedShift && selectedQuiniela) {

      const newResults = Array.from({ length: 20 }, () => Math.floor(Math.random() * 10000).toString().padStart(2, '0'));
      setResults(newResults);
    } else {

      setResults(Array(20).fill(''));
    }
  }, [selectedShift, selectedQuiniela]);

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
        <div className="  rounded-xl   space-y-6">
          <ResultShifts shifts={MODALIDADES} onShiftSelect={handleShiftSelect} />
          <QuiniChecks quini={quinielas} onQuinielaSelect={handleQuinielaSelect} />

          <div className="border border-dark-lighter bg-[var(--bg-card)] rounded-lg p-4 pt-[56px]">
            <h3 className="text-sm font-medium mb-4">Resultados</h3>
            <Box className="grid grid-cols-4 gap-6">
              {Array.from({ length: 20 }, (_, i) => (
                <div key={i} className="flex items-center gap-2">
                  <span className="text-sm font-medium w-6">{i + 1}</span>
                  <Input
                    type="text"
                    value={results[i]}
                    onChange={(e) => {
                      const newResults = [...results];
                      newResults[i] = e.target.value;
                      setResults(newResults);
                    }}
                    className="w-full bg-[var(--bg-card)] border border-dark-lighter rounded px-2 py-1"
                  />
                </div>
              ))}
            </Box>
            <Box className=" grid grid-cols-2 py-4 mt-6 gap-[24px] ">
              <Button
                variant={'outline'}
                className="  bg-cyan hover:bg-[var(--bg-card)] text-dark w-full font-medium"
              >
                <PencilIcon /> Editar
              </Button>
              <Button variant={'default'} className=" w-full   text-white">
                <SaveIcon /> Guardar Results
              </Button>
            </Box>
          </div>
        </div>
      </div>
    </Box>
  );
};

export default ResultsContent;
