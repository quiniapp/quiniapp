import { Trash2Icon, TimerReset } from 'lucide-react';

import { Flex, FlexCol } from '@/components/flex';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { usePlayDetails } from './context/MakePlaysContext';
import { IconButton } from '@/components/button/IconButton';

const ResultsOverview = () => {
  const {
    partialAmount,
    totalAmount,
    selectedIndexes,
    handleCreateBet,
    handleResetBets,
    handleDeleteSelectedBets,
    isEnabledCreateBetByAdmin,
    isPendingCreate,
    isPendingEdit,
  } = usePlayDetails();

  const hasSelection = selectedIndexes.length > 0;
  const isEnabled = totalAmount > 0 && isEnabledCreateBetByAdmin;

  return (
    <Flex
      className={
        'flex-col sm:flex-row gap-2 sm:gap-4 p-1 1440:p-2 items-center  sticky bottom-0 bg-background z-10'
      }
    >
      <Flex
        className={'flex-col sm:flex-row justify-between gap-2 sm:gap-4 lg:gap-2 w-full sm:flex-1'}
      >
        <Flex className="gap-2 lg:gap-1.5 min-w-fit w-full sm:w-auto">
          {/* Mobile: Single row with two columns */}
          <Flex className="sm:hidden w-full justify-between">
            <Flex className='w-full'>
              <span className="text-xs">
                Monto parcial:{' '}
                <span className="font-semibold">$ {partialAmount.toLocaleString('es-AR')}</span>
              </span>
            </Flex>
            <Flex className='w-full'>
              <span className="text-xs">
                <span className="uppercase">Total</span>:{' '}
                <span className="font-semibold">$ {totalAmount.toLocaleString('es-AR')}</span>
              </span>
            </Flex>
          </Flex>

          {/* Desktop: Two columns layout */}
          <Flex className="hidden sm:flex gap-2 lg:gap-1.5">
            <FlexCol>
              <span className="text-sm whitespace-nowrap">Monto parcial</span>
              <span className="text-sm whitespace-nowrap">Total</span>
            </FlexCol>
            <FlexCol>
              <span className="text-sm font-semibold">
                $ {partialAmount.toLocaleString('es-AR')}
              </span>
              <span className="text-sm font-semibold">$ {totalAmount.toLocaleString('es-AR')}</span>
            </FlexCol>
          </Flex>
        </Flex>
        <FlexCol className="hidden md:flex ">
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
        <IconButton
          label="Cerrar Ticket"
          onClick={() => handleCreateBet()}
          disabled={!isEnabled || isPendingCreate || isPendingEdit}
          className="flex-1 sm:flex-none  lg:min-w-[80px]"
        />
        <IconButton
          label="Eliminar"
          icon={<Trash2Icon className="w-4 h-4" />}
          onClick={handleDeleteSelectedBets}
          variant="destructive"
          disabled={!hasSelection}
          className="flex-1 sm:flex-none  lg:min-w-[80px]"
        />
        <IconButton
          label="Reiniciar"
          icon={<TimerReset className="w-4 h-4" />}
          onClick={() => handleResetBets()}
          variant="outline"
          className="flex-1 sm:flex-none  lg:min-w-[80px]"
        />
      </Flex>
    </Flex>
  );
};

export default ResultsOverview;
