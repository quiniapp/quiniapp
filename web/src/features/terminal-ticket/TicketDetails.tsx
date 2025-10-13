import { Flex, FlexCol } from '@/components/flex';
import TerminalTicketPlayTable from './termina-ticket-play-table';
import TerminalTicketMatchesTable from './terminal-ticket-matches-table';
import { useSearchParams } from 'react-router-dom';
import { useGetBetysByTicketNumber } from '@/hooks/fetchs/plays/useGetBetysByTicketNumber';

const TicketDetails = () => {
  const [searchParams] = useSearchParams();
  const ticket_number = searchParams.get('ticket_number');
  const date = searchParams.get('date');
  const { data: bets, isLoading } = useGetBetysByTicketNumber({
    date: date ,
    ticket_number: ticket_number,
  });

  const { data: winnersBets, isLoading: isLoadingWinners } = useGetBetysByTicketNumber({
    date: date,
    ticket_number: ticket_number,
    winners: 'true',
  });

  return (
    <Flex className={'1440:py-8 py-3 space-x-8 '}>
      <FlexCol className={'flex-1  space-y-4'}>
        <p> Jugadas {`${ticket_number ? `ticket ${ticket_number}` : ''}`}</p>
        <TerminalTicketPlayTable bets={bets} isLoading={isLoading} />
      </FlexCol>
      <FlexCol className={'flex-1 space-y-4'}>
        <p> Aciertos</p>
        <TerminalTicketMatchesTable bets={winnersBets} isLoading={isLoadingWinners} />
      </FlexCol>
    </Flex>
  );
};

export default TicketDetails;
