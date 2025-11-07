import { FlexCol } from '@/components/flex';
import TerminalTicketPlayTable from './termina-ticket-play-table';
import TerminalTicketMatchesTable from './terminal-ticket-matches-table';
import { useSearchParams } from 'react-router-dom';
import { useGetBetysByTicketNumber } from '@/hooks/fetchs/plays/useGetBetysByTicketNumber';

const TicketDetails = () => {
  const [searchParams] = useSearchParams();
  const ticket_number = searchParams.get('ticket_number');
  const date = searchParams.get('date');
  const { data: bets, isLoading } = useGetBetysByTicketNumber({
    date: date,
    ticket_number: ticket_number,
  });

  const { data: winnersBets, isLoading: isLoadingWinners } = useGetBetysByTicketNumber({
    date: date,
    ticket_number: ticket_number,
    winners: 'true',
  });

  return (
    <FlexCol className="flex-1 overflow-y-auto min-h-40 ">
      <p>{ticket_number ? `Ticket ${ticket_number}` : ''}</p>

      <FlexCol className="flex-col-reverse  sm:flex-row 1440:py-8 py-3 sm:space-x-8 min-h-0">
        {/* Columna Jugadas */}
        <FlexCol className="flex-1 min-h-0 space-y-4 overflow-hidden">
          <p>{`Jugadas | Cantidad jugadas: ${
            bets?.length ?? 0}`}</p>
          <TerminalTicketPlayTable bets={bets} isLoading={isLoading} />
        </FlexCol>

        {/* Columna Aciertos */}
        <FlexCol className="flex-1 min-h-0 space-y-4 overflow-hidden">
          <p>{`Aciertos | Cantidad aciertos: ${
            winnersBets?.length ?? 0}`}</p>
          <TerminalTicketMatchesTable bets={winnersBets} isLoading={isLoadingWinners} />
        </FlexCol>
      </FlexCol>
    </FlexCol>
  );
};

export default TicketDetails;
