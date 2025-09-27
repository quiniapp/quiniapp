import { useMutation, useQueryClient } from '@tanstack/react-query';
import { BACKEND_ROUTES } from '../../../../routes/routes';
import {INewTicketEntity} from '../../../../../helper/request/ticket.response'


const createTicket = async (payload:INewTicketEntity) => {

  const res = await fetch(BACKEND_ROUTES.ticket.base, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify({newTicket:payload}),
  });
  if (!res.ok) throw new Error('Error creating ticket');
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


