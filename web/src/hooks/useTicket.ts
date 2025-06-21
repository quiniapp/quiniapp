import { useMutation, useQueryClient } from '@tanstack/react-query';
import { ROUTES } from '../../routes/routes';
import {INewTicketEntity} from '../../../helper/request/ticket.response'


const createTicket = async (payload:INewTicketEntity) => {

  const res = await fetch(ROUTES.ticket.base, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify({newTicket:payload}),
  });
  if (!res.ok) throw new Error('Error creating ticket');
  return res.json();
};

const deleteTicket = async (ticketId: string) => {
  const res = await fetch(ROUTES.ticket.id(ticketId), {
    method: 'DELETE',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
  });
  if (!res.ok) throw new Error('Error deleting ticket');
  return res.json();
};

export const useCreateTicket = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: createTicket,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tickets'] }); // refetch si tenés un listado
    },
  });
};

export const useDeleteTicket = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: deleteTicket,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tickets'] });
    },
  });
};
