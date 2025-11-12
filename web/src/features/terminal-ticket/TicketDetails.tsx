import { FlexCol } from '@/components/flex';
import TerminalTicketPlayTable from './termina-ticket-play-table';
import TerminalTicketMatchesTable from './terminal-ticket-matches-table';
import { useSearchParams } from 'react-router-dom';
import { useInfiniteBetsByTicketNumber } from '@/hooks/fetchs/plays/useInfiniteBetsByTicketNumber';
import { useMemo } from 'react';

const TicketDetails = () => {
  const [searchParams] = useSearchParams();
  const ticket_number = searchParams.get('ticket_number');
  const date = searchParams.get('date');

  const {
    data: betsData,
    fetchNextPage: fetchNextBets,
    hasNextPage: hasNextBets,
    isFetchingNextPage: isFetchingNextBets,
    isLoading,
  } = useInfiniteBetsByTicketNumber({
    date: date,
    ticket_number: ticket_number,
    limit: 100,
  });

  const {
    data: winnersBetsData,
    fetchNextPage: fetchNextWinners,
    hasNextPage: hasNextWinners,
    isFetchingNextPage: isFetchingNextWinners,
    isLoading: isLoadingWinners,
  } = useInfiniteBetsByTicketNumber({
    date: date,
    ticket_number: ticket_number,
    winners: 'true',
    limit: 100,
  });

  // Flatten all pages into single arrays
  const bets = useMemo(() => {
    return betsData?.pages.flatMap((page) => page.data) ?? [];
  }, [betsData]);

  const winnersBets = useMemo(() => {
    return winnersBetsData?.pages.flatMap((page) => page.data) ?? [];
  }, [winnersBetsData]);

  return (
    <FlexCol className="flex-1 overflow-y-auto min-h-40 ">
      <p>{ticket_number ? `Ticket ${ticket_number}` : ''}</p>

      <FlexCol className="flex-col-reverse  sm:flex-row 1440:py-8 py-3 sm:space-x-8 min-h-0">
        {/* Columna Jugadas */}
        <FlexCol className="flex-1 min-h-0 space-y-4 overflow-hidden">
          <p>{`Jugadas | Cantidad jugadas: ${
            bets?.length ?? 0}`}</p>
          <TerminalTicketPlayTable
            bets={bets}
            isLoading={isLoading}
            hasNextPage={hasNextBets ?? false}
            isFetchingNextPage={isFetchingNextBets}
            fetchNextPage={fetchNextBets}
          />
        </FlexCol>

        {/* Columna Aciertos */}
        <FlexCol className="flex-1 min-h-0 space-y-4 overflow-hidden">
          <p>{`Aciertos | Cantidad aciertos: ${
            winnersBets?.length ?? 0}`}</p>
          <TerminalTicketMatchesTable
            bets={winnersBets}
            isLoading={isLoadingWinners}
            hasNextPage={hasNextWinners ?? false}
            isFetchingNextPage={isFetchingNextWinners}
            fetchNextPage={fetchNextWinners}
          />
        </FlexCol>
      </FlexCol>
    </FlexCol>
  );
};

export default TicketDetails;
