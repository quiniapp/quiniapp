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
        'justify-between py-[16px] items-center border-t-2 sticky bottom-0 bg-background z-10'
      }
    >
      <FlexCol>
        <Flex>Monto parcial</Flex>
        <Flex>Total</Flex>
      </FlexCol>
      <FlexCol>
        <Flex>$ {partialAmount}</Flex>
        <Flex>$ {totalAmount}</Flex>
      </FlexCol>
      <Flex className={'space-x-[100px] items-center '}>
        <FlexCol>
          <RadioGroup defaultValue="option-one">
            <Flex className=" items-center space-x-2">
              <RadioGroupItem value="option-one" id="option-one" />
              <Label htmlFor="option-one">Imprimir</Label>
            </Flex>
            <Flex className=" items-center space-x-2">
              <RadioGroupItem value="option-two" id="option-two" />
              <Label htmlFor="option-two">Exportar</Label>
            </Flex>
          </RadioGroup>
        </FlexCol>
        <Flex className={'gap-4'}>
          <Button onClick={() => handleCreateBet()} disabled={totalAmount === 0}>
            Cerrar Ticket{' '}
          </Button>
          <Button  onClick={onDeleteSelected} variant="destructive" disabled={!hasSelection}>
            <Trash2Icon /> Eliminar
          </Button>
          <Button onClick={() => handleResetBets()} variant={'outline'}>
            <TimerReset /> Reiniciar
          </Button>
        </Flex>
      </Flex>
    </Flex>
  );
};

export default ResultsOverview;
