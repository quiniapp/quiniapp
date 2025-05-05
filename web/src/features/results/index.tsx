import { useEffect, useState } from 'react';

import { Clock, PencilIcon, RefreshCw, SaveIcon } from 'lucide-react';
import { Flex, FlexCol } from '@/components/flex';
import { Button } from '@/components/ui/button';

import Box from '@/components/box';
import HeaderSection from '@/components/header-section';

import { Input } from '@/components/ui/input.tsx';

import { SelectDayToSearch } from '@/features/plays-and-hits/select-day-to-search.tsx';
import ResultShifts from '@/features/results/shifts.tsx';
import QuiniChecks from '@/features/results/quini-check.tsx';
import { MODALIDADES } from '@/constants/LIstCommonBets.ts';
import HeaderTitleSection from '@/components/header-title-section';
import { useMediaQuery } from '@/hooks/useMediaQuery.ts';

const ResultsContent = () => {
  const [results, setResults] = useState<string[]>(Array(20).fill(''));
  const [selectedShift, setSelectedShift] = useState<string | null>(null);
  const [selectedLottery, setSelectedLottery] = useState<string | null>(null);
  const [onEdit, setOnEdit] = useState(true);

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

  const handleLotterySelect = (quinielaId: string) => {
    setSelectedLottery(quinielaId);
  };

  useEffect(() => {
    if (selectedShift && selectedLottery) {
      const newResults = Array.from({ length: 20 }, () =>
        Math.floor(Math.random() * 10000)
          .toString()
          .padStart(2, '0')
      );
      setResults(newResults);
    } else {
      setResults(Array(20).fill(''));
    }
  }, [selectedShift, selectedLottery]);

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
      <Box className="grid grid-cols-1 lg:grid-cols-2  gap-8 py-[36px]  ">
        <FlexCol className="  rounded-xl   space-y-6">
          <ResultShifts shifts={MODALIDADES} onShiftSelect={handleShiftSelect} />
          <QuiniChecks quini={quinielas} onLotterySelect={handleLotterySelect} />
        </FlexCol>
        <div className=" ">
          <HeaderTitleSection
            title={'Resultados'}
            icon={<Clock size={useMediaQuery('(min-width: 1440px)') ? '24px' : '16px'} />}
            variant={useMediaQuery('(min-width: 1440px)') ? 'large' : 'small'}
            className={'pb-2'}
          />
          <Box className="grid grid-cols-4 gap-6 p-8 justify-between bg-card">
            {Array.from({ length: 20 }, (_, i) => (
              <div key={i} className="flex items-center gap-2">
                <span className="text-sm text-primary font-medium w-6">{i + 1}</span>
                <Input
                  type="text"
                  value={results[i]}
                  onChange={(e) => {
                    const newResults = [...results];
                    newResults[i] = e.target.value;
                    setResults(newResults);
                  }}
                  disabled={onEdit}
                  className="w-full bg-card-foreground border border-dark-lighter rounded px-2 py-1"
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
            <Button variant={'default'} className=" w-full   text-white">
              <SaveIcon /> Guardar Results
            </Button>
          </Box>
        </div>
      </Box>
    </Box>
  );
};

export default ResultsContent;
