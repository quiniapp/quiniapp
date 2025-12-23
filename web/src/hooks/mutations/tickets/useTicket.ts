import { useMutation, useQueryClient } from '@tanstack/react-query';
import { BACKEND_ROUTES } from '../../../../routes/routes';
import { INewTicketEntity } from '@helper/request/ticket.request';
import { ITicketEntityFront } from '@helper/types/ticket.type';
import { apiClient } from '@/lib/apiClient';

const createTicket = async (payload: INewTicketEntity) => {
  return await apiClient.post<ITicketEntityFront>(BACKEND_ROUTES.ticket.base, {
    newTicket: payload,
  });
};

export const useCreateTicket = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: createTicket,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tickets'] });
    },
  });
};


