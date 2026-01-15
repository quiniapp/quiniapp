import { useMutation, useQueryClient } from '@tanstack/react-query';
import { BACKEND_ROUTES } from '../../../../routes/routes.ts';
import { apiClient } from '@/lib/apiClient';

const doPaidTicket = async (ticket_number: string) => {
  await apiClient.put(BACKEND_ROUTES.ticket.paid(ticket_number));
  return true as const;
};

export const usePaidTicket = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (ticket_number?: string) => {
      if (!ticket_number) throw new Error('ticket_number requerido');
      return doPaidTicket(ticket_number);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ['tickets-infinite'],
        exact: false,
        refetchType: 'active',
      });
    },
  });
};
