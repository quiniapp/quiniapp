import { useMutation, useQueryClient } from '@tanstack/react-query';
import { BACKEND_ROUTES } from '../../../../routes/routes.ts';
import { IEditTicketEntity } from '../../../../../helper/request/ticket.response.ts';

const doEditTicket = async ({ ticket_id, bets }: IEditTicketEntity) => {
  const res = await fetch(BACKEND_ROUTES.ticket.id(ticket_id), {
    method: 'PUT',  
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify({ bets: bets }),
  });
  console.log(res)
  if (!res.ok) throw new Error('Error creating ticket');
  return res.json();
};

export const useEditTicket = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ ticket_id, bets }: IEditTicketEntity) => {
      if (!ticket_id) throw new Error('ticketId requerido');
      return doEditTicket({ ticket_id, bets });
    },
    // Invalida TODO lo que empiece con ['tickets'] (activos) para asegurar refetch
    onSuccess: async () => {
      await queryClient.invalidateQueries({
        queryKey: ['tickets'],
        exact: false,
        refetchType: 'active',
      });
    },
  });
};
