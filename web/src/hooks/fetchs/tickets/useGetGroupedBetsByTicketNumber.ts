import { useQuery } from '@tanstack/react-query';
import { BACKEND_ROUTES } from '../../../../routes/routes';
import { ITicketEntityFront } from '@helper/types/ticket.type';

const fetchTicketsByNumber = async (
  ticket_number?: string | null
): Promise<ITicketEntityFront | undefined> => {
  const res = await fetch(`${BACKEND_ROUTES.ticket.base}?ticket_number=${ticket_number}`, {
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
  });
  if (!res.ok) throw new Error('Error fetching tickets');
  const { data } = await res.json();

  return data.ticket[0];
};

export const useGetGroupedBetsByTicketNumber = (ticket_number?: string | null) =>
  useQuery({
    queryKey: ['grouped_ticket_number', ticket_number],
    queryFn: () => fetchTicketsByNumber(ticket_number),
    enabled: !!ticket_number && ticket_number?.length ===17,
  });
