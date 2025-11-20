// @components
import { Flex } from '@/components/flex';
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
    <Flex className="flex-col sm:flex-row w-full  justify-between sticky bottom-0 z-10 gap-2 sm:gap-4 p-1 1440:p-2 ">
      <TextAmount label="Total monto de aciertos:" value={totalHitsAmount} />
      <TextAmount label="Total monto de jugadas:" value={totalPlaysAmount} />
      <TextAmount label="Tickets cancelados:" value={Number(data)} />
    </Flex>
  );
};

export default TotalAmountPlayAndHits;
