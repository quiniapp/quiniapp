import { XIcon } from 'lucide-react';

// @components
import { Flex, FlexCol } from '@/components/flex';
import { Button } from '@/components/ui/button.tsx';

const TotalAmountPlayAndHits = () => {
  return (
    <Flex className={'items-center justify-between py-[16px]'}>
      <FlexCol>
        <p>Total Monto de juagada: </p>
        <p>Total Monto de ciertos: </p>
      </FlexCol>
      <Button className={'w-[130px] bg-white text-neutral-700 font-bold'}>
        Cerrar <XIcon />
      </Button>
    </Flex>
  );
};

export default TotalAmountPlayAndHits;
