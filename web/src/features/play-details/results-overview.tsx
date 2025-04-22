import { Flex, FlexCol } from '@/components/flex';
import { Button } from '@/components/ui/button.tsx';
import { Trash2Icon, TimerReset } from 'lucide-react';

import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';

const ResultsOverview = () => {
  return (
    <Flex className={'justify-between py-[24px] border-t-2'}>
      <FlexCol>
        <Flex>Monto parcial</Flex>
        <Flex>Total</Flex>
      </FlexCol>
      <Flex className={'space-x-[100px]'}>
        <FlexCol >
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
          <Button>Cerrar Ticket </Button>
          <Button variant={'outline'}>
            <Trash2Icon /> Eliminar
          </Button>
          <Button variant={'outline'}>
            <TimerReset /> Reiniciar
          </Button>
        </Flex>
      </Flex>
    </Flex>
  );
};

export default ResultsOverview;
