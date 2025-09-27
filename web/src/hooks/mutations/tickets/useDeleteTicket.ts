import { useMutation, useQueryClient } from '@tanstack/react-query';
import { BACKEND_ROUTES } from '../../../../routes/routes.ts';

const doDeleteTicket = async (ticketId: string) => {
  const res = await fetch(BACKEND_ROUTES.ticket.id(ticketId), {
    method: 'DELETE',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
  });
  if (!res.ok) throw new Error('Error deleting ticket');
  return true as const;
};

export const useDeleteTicket = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (ticketId?: string) => {
      if (!ticketId) throw new Error('ticketId requerido');
      return doDeleteTicket(ticketId);
    },
    // Invalida TODO lo que empiece con ['tickets'] (activos) para asegurar refetch
    onSuccess: async () => {
      await queryClient.invalidateQueries({
        queryKey: ['tickets'],
        exact:false,
        refetchType: 'active',
      });
    },
  });
};
