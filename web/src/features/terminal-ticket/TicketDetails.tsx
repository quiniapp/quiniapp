// TicketDetails.tsx
import { FlexCol } from '@/components/flex';
import TerminalTicketPlayTable from './termina-ticket-play-table';
import TerminalTicketMatchesTable from './terminal-ticket-matches-table';
import { useGetAmountsByTicketNumber } from '@/hooks/fetchs/plays/useGetAmountsByTicketNumber';
import { useTerminalTicket } from './provider/TerminalTicketProvider';

const TicketDetails = () => {
  const { ticket_number } = useTerminalTicket();
  const {data} = useGetAmountsByTicketNumber({ticket_number})

  return (
    <FlexCol className="flex-1 overflow-y-auto min-h-40 ">
      <p>{ticket_number ? `Ticket ${ticket_number}` : ''}</p>

      <FlexCol className="flex-col-reverse sm:flex-row 1440:py-8 py-3 sm:space-x-8 min-h-0">
        {/* Jugadas */}
        <FlexCol className="flex-1 min-h-0 space-y-4 overflow-hidden">
          <TerminalTicketPlayTable  amount={data?.total_amount ?? 0} count={data?.total_count ?? 0}/>
        </FlexCol>

        {/* Aciertos */}
        <FlexCol className="flex-1 min-h-0 space-y-4 overflow-hidden">
          <TerminalTicketMatchesTable  prize={data?.total_prize ?? 0} winners_count={data?.total_winners_count ?? 0}/>
        </FlexCol>
      </FlexCol>
    </FlexCol>
  );
};

export default TicketDetails;
