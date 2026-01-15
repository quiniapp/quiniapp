import { useQuery } from '@tanstack/react-query';
import { BACKEND_ROUTES } from '../../../../routes/routes';
import { ITicketEntityFront } from '@helper/types/ticket.type';
import { apiClient } from '@/lib/apiClient';

const fetchTicketsByNumber = async (
  ticket_number?: string | null
): Promise<ITicketEntityFront | undefined> => {
  if (!ticket_number) return undefined;
  const data = await apiClient.get<ITicketEntityFront[]>(BACKEND_ROUTES.ticket.base, {
    params: { ticket_number },
  });
  return data[0];
};

export const useGetGroupedBetsByTicketNumber = (ticket_number?: string | null) =>
  useQuery({
    queryKey: ['grouped_ticket_number', ticket_number],
    queryFn: () => fetchTicketsByNumber(ticket_number),
    enabled: !!ticket_number && ticket_number?.length === 17,
  });
