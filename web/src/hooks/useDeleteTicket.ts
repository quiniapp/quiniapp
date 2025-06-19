import { useMutation, useQueryClient } from '@tanstack/react-query';
import { ROUTES } from '../../routes/routes';

const deleteTicket = async (ticketId: string) => {
  const res = await fetch(ROUTES.ticket.id(ticketId), {
    method: 'DELETE',
    headers: {
      'Content-Type': 'application/json',
    },
    credentials: 'include',
  });

  if (!res.ok) throw new Error('Error deleting ticket');
  return true;
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
