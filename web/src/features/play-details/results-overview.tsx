import { Trash2Icon, TimerReset } from 'lucide-react';

import { Flex, FlexCol } from '@/components/flex';
import { Button } from '@/components/ui/button.tsx';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';

const ResultsOverview = ({
  partialAmount,
  totalAmount,
  handleCreateBet,
  handleResetBets,
  onDeleteSelected,
  hasSelection,
}: {
  partialAmount: number;
  totalAmount: number;
  handleCreateBet: VoidFunction;
  handleResetBets: VoidFunction;
  onDeleteSelected: VoidFunction;
  hasSelection: boolean;
}) => {
  return (
    <Flex
      className={
        'flex-col sm:flex-row gap-2 sm:gap-4 p-1 1440:p-2 items-center  sticky bottom-0 bg-background z-10'
      }
    >
      <Flex className={'justify-between w-full '}>
        <Flex className='gap-2'>
          <FlexCol className="">
            <span className="text-xs 1440:text-sm">Monto parcial</span>
            <span className="text-xs 1440:text-sm">Total</span>
          </FlexCol>
          <FlexCol>
            <span className="text-xs 1440:text-sm">$ {partialAmount}</span>
            <span className="text-xs 1440:text-sm">$ {totalAmount}</span>
          </FlexCol>
        </Flex>
        <FlexCol>
          <RadioGroup defaultValue="option-one">
            <Flex className=" items-center space-x-2">
              <RadioGroupItem value="option-one" id="option-one" />
              <Label className="text-xs 1440:text-sm" htmlFor="option-one">
                Imprimir
              </Label>
            </Flex>
            <Flex className=" items-center space-x-2">
              <RadioGroupItem value="option-two" id="option-two" />
              <Label className="text-xs 1440:text-sm" htmlFor="option-two">
                Exportar
              </Label>
            </Flex>
          </RadioGroup>
        </FlexCol>
      </Flex>
      <Flex className={'gap-4 items-center '}>
        <Button onClick={() => handleCreateBet()} disabled={totalAmount === 0}>
          Cerrar Ticket{' '}
        </Button>
        <Button onClick={onDeleteSelected} variant="destructive" disabled={!hasSelection}>
          <Trash2Icon /> Eliminar
        </Button>
        <Button onClick={() => handleResetBets()} variant={'outline'}>
          <TimerReset /> Reiniciar
        </Button>
      </Flex>
    </Flex>
  );
};

export default ResultsOverview;
