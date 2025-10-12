// @components
import { Flex, FlexCol } from '@/components/flex';
import { useGetDeletedTickets } from '@/hooks/fetchs/tickets/useGetDeletedTickets';
import { useSearchParams } from 'react-router-dom';

const TotalAmountPlayAndHits = ({
  totalHitsAmount,
  totalPlaysAmount,
}: {
  totalHitsAmount?: number;
  totalPlaysAmount?: number;
}) => {
  const [searchParams] = useSearchParams();
  const date = searchParams.get('date');
  const user_id = searchParams.get('cashier_id');
  const { data } = useGetDeletedTickets({ date, user_id });

  return (
    <Flex className="max-w-96 justify-between">
      <FlexCol
        className={' gap-2 sm:gap-4 p-1 1440:p-2 items-start  sticky bottom-0 bg-background z-10'}
      >
        <Flex className="text-xs md:text-sm gap-1 sm:gap-3 ">
          <p>Total Monto de aciertos: $</p>
          <p>{totalHitsAmount} </p>
        </Flex>
        <Flex className="text-xs md:text-sm gap-1 sm:gap-3">
          <p>Total Monto de jugadas: $</p>
          <p>{totalPlaysAmount}</p>
        </Flex>
      </FlexCol>
      <FlexCol
        className={' gap-2 sm:gap-4 p-1 1440:p-2 items-start  sticky bottom-0 bg-background z-10'}
      >
        <Flex className="text-xs md:text-sm gap-1 sm:gap-3 ">
          <p>Tickets cancelados: </p>
          <p>{data} </p>
        </Flex>
      </FlexCol>
    </Flex>
  );
};

export default TotalAmountPlayAndHits;
