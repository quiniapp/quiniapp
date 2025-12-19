import { useMutation, useQueryClient } from '@tanstack/react-query';
import { BACKEND_ROUTES } from '../../../../routes/routes.ts';
import { apiClient } from '@/lib/apiClient';

const doDeleteTicket = async (ticketId: string) => {
  await apiClient.delete(BACKEND_ROUTES.ticket.id(ticketId));
  return true as const;
};

export const useDeleteTicket = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (ticketId?: string) => {
      if (!ticketId) throw new Error('ticketId requerido');
      return doDeleteTicket(ticketId);
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({
        queryKey: ['tickets-infinite'],
        exact: false,
        refetchType: 'active',
      });
    },
  });
};
