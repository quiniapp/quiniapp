import { XIcon } from 'lucide-react';

// @components
import { Flex, FlexCol } from '@/components/flex';
import { Button } from '@/components/ui/button.tsx';

const TotalAmountPlayAndHits = ({
  totalHitsAmount,
  totalPlaysAmount,
}: {
  totalHitsAmount?: number;
  totalPlaysAmount?: number;
}) => {
  return (
    <Flex
      className={
        ' gap-2 sm:gap-4 p-1 1440:p-2 items-center  sticky bottom-0 bg-background z-10'
      }
    >
      <FlexCol className="text-xs md:text-sm ">
        <p>Total Monto de jugadas: </p>
        <p>Total Monto de aciertos: </p>
      </FlexCol>
      <FlexCol className="text-xs md:text-sm ">
        <p>{totalPlaysAmount}</p>
        <p>{totalHitsAmount} </p>
      </FlexCol>
    </Flex>
  );
};

export default TotalAmountPlayAndHits;
