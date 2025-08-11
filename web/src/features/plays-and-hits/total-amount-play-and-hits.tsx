

// @components
import { Flex, FlexCol } from '@/components/flex';

const TotalAmountPlayAndHits = ({
  totalHitsAmount,
  totalPlaysAmount,
}: {
  totalHitsAmount?: number;
  totalPlaysAmount?: number;
}) => {
  return (
    <FlexCol
      className={' gap-2 sm:gap-4 p-1 1440:p-2 items-start  sticky bottom-0 bg-background z-10'}
    >
      <Flex className="text-xs md:text-sm gap-1 sm:gap-3 ">
        <p>Total Monto de aciertos: </p>
        <p>{totalHitsAmount} </p>
      </Flex>
      <Flex className="text-xs md:text-sm gap-1 sm:gap-3">
        <p>Total Monto de jugadas: </p>
        <p>{totalPlaysAmount}</p>
      </Flex>
    </FlexCol>
  );
};

export default TotalAmountPlayAndHits;
