import { Trash2Icon, TimerReset } from 'lucide-react';

import { Flex, FlexCol } from '@/components/flex';
import { Button } from '@/components/ui/button.tsx';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { usePlayDetails } from './context/MakePlaysContext';

const ResultsOverview = () => {
  const {
    partialAmount,
    totalAmount,
    selectedIndexes,
    handleCreateBet,
    handleResetBets,
    handleDeleteSelectedBets,
    isEnabledCreateBetByAdmin,
  } = usePlayDetails();

  const hasSelection = selectedIndexes.length > 0;
  const isEnabled = totalAmount > 0 && isEnabledCreateBetByAdmin;

  return (
    <Flex
      className={
        'flex-col sm:flex-row gap-2 sm:gap-4 p-1 1440:p-2 items-center  sticky bottom-0 bg-background z-10'
      }
    >
      <Flex className={'flex-col sm:flex-row justify-between gap-2 sm:gap-4 lg:gap-2 w-full sm:flex-1'}>
        <Flex className="gap-2 lg:gap-1.5 min-w-fit">
          <FlexCol className="">
            <span className="text-xs sm:text-sm  whitespace-nowrap">Monto parcial</span>
            <span className="text-xs sm:text-sm  whitespace-nowrap">Total</span>
          </FlexCol>
          <FlexCol>
            <span className="text-xs sm:text-sm  font-semibold">$ {partialAmount}</span>
            <span className="text-xs sm:text-sm font-semibold">$ {totalAmount}</span>
          </FlexCol>
        </Flex>
        <FlexCol className="hidden md:flex lg:hidden xl:flex">
          <RadioGroup defaultValue="option-one">
            <Flex className="items-center space-x-2">
              <RadioGroupItem value="option-one" id="option-one" />
              <Label className="text-sm md:text-base " htmlFor="option-one">
                Imprimir
              </Label>
            </Flex>
            <Flex className="items-center space-x-2">
              <RadioGroupItem value="option-two" id="option-two" />
              <Label className="text-sm md:text-base" htmlFor="option-two">
                Exportar
              </Label>
            </Flex>
          </RadioGroup>
        </FlexCol>
      </Flex>
      <Flex className={'gap-2 lg:gap-1.5 items-center w-full sm:w-auto justify-center flex-wrap'}>
        <Button onClick={() => handleCreateBet()} disabled={!isEnabled} size="sm" className="flex-1 sm:flex-none min-w-[100px] lg:min-w-[80px]">
          <span className="hidden sm:inline">Cerrar Ticket</span>
          <span className="sm:hidden">Cerrar</span>
        </Button>
        <Button onClick={handleDeleteSelectedBets} variant="destructive" disabled={!hasSelection} size="sm" className="flex-1 sm:flex-none min-w-[100px] lg:min-w-[80px]">
          <Trash2Icon className="sm:mr-1 lg:mr-0.5" /> <span className="hidden sm:inline">Eliminar</span>
        </Button>
        <Button onClick={() => handleResetBets()} variant={'outline'} size="sm" className="flex-1 sm:flex-none min-w-[100px] lg:min-w-[80px]">
          <TimerReset className="sm:mr-1 lg:mr-0.5" /> <span className="hidden sm:inline">Reiniciar</span>
        </Button>
      </Flex>
    </Flex>
  );
};

export default ResultsOverview;
