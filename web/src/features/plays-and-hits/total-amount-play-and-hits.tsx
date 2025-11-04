// @components
import { Flex, FlexCol } from '@/components/flex';
import { TextAmount } from '@/components/text/TextAmount';
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
    <Flex className="w-full max-w-[28rem] justify-between">
      <FlexCol className="gap-2 sm:gap-4 p-1 1440:p-2 sticky bottom-0 bg-background z-10">
        <TextAmount label="Total Monto de aciertos:" value={totalHitsAmount} />
        <TextAmount label="Total Monto de jugadas:" value={totalPlaysAmount} />
      </FlexCol>

      <FlexCol className="gap-2 sm:gap-4 p-1 1440:p-2 sticky bottom-0 bg-background z-10">
        <TextAmount label="Tickets cancelados:" value={Number(data)} />
      </FlexCol>
    </Flex>
  );
};

export default TotalAmountPlayAndHits;
