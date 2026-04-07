import { useMutation, useQueryClient } from '@tanstack/react-query';
import { BACKEND_ROUTES } from '../../../../routes/routes.ts';
import { IEditTicketEntity } from '@helper/request/ticket.request.ts';
import { ITicketEntityFront } from '@helper/types/ticket.type';
import { apiClient } from '@/lib/apiClient';

const doEditTicket = async ({ ticket_id, bets }: IEditTicketEntity) => {
  return await apiClient.put<ITicketEntityFront>(BACKEND_ROUTES.ticket.id(ticket_id), {
    bets: bets,
  });
};

export const useEditTicket = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ ticket_id, bets }: IEditTicketEntity) => {
      if (!ticket_id) throw new Error('ticketId requerido');
      return doEditTicket({ ticket_id, bets });
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({
        queryKey: ['tickets'],
        exact: false,
        refetchType: 'active',
      });
      queryClient.invalidateQueries({ queryKey: ['bets-infinite'], exact: false });
      queryClient.invalidateQueries({ queryKey: ['tickets-infinite'], exact: false });
    },
  });
};
