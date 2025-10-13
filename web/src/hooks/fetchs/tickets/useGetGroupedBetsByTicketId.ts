import { useQuery } from '@tanstack/react-query';
import { BACKEND_ROUTES } from '../../../../routes/routes';
import { ITicketEntityFront } from '@helper/types/ticket.type';

const fetchTicketsByTicketId = async (
  ticket_id?: string | null
): Promise<ITicketEntityFront | undefined> => {
  const res = await fetch(`${BACKEND_ROUTES.ticket.base}/${ticket_id}`, {
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
  });
  if (!res.ok) throw new Error('Error fetching tickets');
  const { data } = await res.json();

  return data.ticket;
};

export const useGetGroupedBetsByTicketId = (ticket_id?: string | null) =>
  useQuery({
    queryKey: ['grouped_ticket_id', ticket_id],
    queryFn: () => fetchTicketsByTicketId(ticket_id),
    enabled: !!ticket_id,
  });
