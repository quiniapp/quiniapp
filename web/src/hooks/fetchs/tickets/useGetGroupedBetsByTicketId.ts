import { useQuery } from '@tanstack/react-query';
import { BACKEND_ROUTES } from '../../../../routes/routes';
import { ITicketEntityFront } from '@helper/types/ticket.type';
import { apiClient } from '@/lib/apiClient';

const fetchTicketsByTicketId = async (
  ticket_id?: string | null
): Promise<ITicketEntityFront | undefined> => {
  if (!ticket_id) return undefined;
  return await apiClient.get<ITicketEntityFront>(`${BACKEND_ROUTES.ticket.base}/${ticket_id}`);
};

export const useGetGroupedBetsByTicketId = (ticket_id?: string | null) =>
  useQuery({
    queryKey: ['grouped_ticket_id', ticket_id],
    queryFn: () => fetchTicketsByTicketId(ticket_id),
    enabled: !!ticket_id,
  });
