import { Flex, FlexCol } from '@/components/flex';
import { useMemo } from 'react';
import TerminalTicketPlayTable from './termina-ticket-play-table';
import TerminalTicketMatchesTable from './terminal-ticket-matches-table';
import { useSearchParams } from 'react-router-dom';
import { getTicketByNumber } from '@/hooks/fetchs/tickets/useGetByNumber';

const TicketDetails = () => {
  const [searchParams] = useSearchParams();
  const ticket_number = searchParams.get('ticket_number');
  const { data } = getTicketByNumber(ticket_number);

  const winningBets = useMemo(() => {
    if (data)
      return data?.bets.filter((bet) => {
        if (bet.winner) return bet;
      });
  }, [ticket_number, data]);

  return (
    <Flex className={'1440:py-8 py-3 space-x-8 '}>
      <FlexCol className={'flex-1  space-y-4'}>
        <p> Jugadas</p>
        <TerminalTicketPlayTable bets={data?.bets} />
      </FlexCol>
      <FlexCol className={'flex-1 space-y-4'}>
        <p> Aciertos</p>
        <TerminalTicketMatchesTable bets={winningBets} />
      </FlexCol>
    </Flex>
  );
};

export default TicketDetails;
