import { useMutation, useQueryClient } from '@tanstack/react-query';
import { BACKEND_ROUTES } from '../../../../routes/routes.ts';

const doPaidTicket = async (ticket_number: string) => {
  const res = await fetch(BACKEND_ROUTES.ticket.paid(ticket_number), {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
  });
  if (!res.ok) throw new Error('Error pagando ticket');
  return true as const;
};

export const usePaidTicket = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (ticket_number?: string) => {
      if (!ticket_number) throw new Error('ticket_number requerido');
      return doPaidTicket(ticket_number);
    },
    // Invalida TODO lo que empiece con ['tickets'] (activos) para asegurar refetch
    onSuccess: async () => {
      await queryClient.invalidateQueries({
        queryKey: ['tickets-infinite'],
        exact: false,
        refetchType: 'active',
      });
      // await queryClient.refetchQueries({queryKey:['tickets']})
    },
  });
};
