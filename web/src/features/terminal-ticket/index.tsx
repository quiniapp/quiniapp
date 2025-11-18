import { TicketX } from 'lucide-react';

// @Components
import { IconButton } from '@/components/button/icon-button';
import { Flex, FlexCol } from '@/components/flex';
import HeaderSection from '@/components/header-section';
import FormHeaderFilter from '@/features/terminal-ticket/form-header-filter';
import TableTerminalTicket from '@/features/terminal-ticket/table-terminal-ticket'; // @Hooks

import TicketDetails from './TicketDetails';
import { useSearchParams } from 'react-router-dom';
import { useDeleteTicket } from '@/hooks/mutations/tickets/useDeleteTicket';
import toast from 'react-hot-toast';
import { PageWrapper } from '@/components/wrapper/PageWrapper';

export const TerminalTicketContent = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const date = searchParams.get('date') ?? undefined;
  const cashier_id = searchParams.get('cashier_id') ?? undefined;
  const filter = searchParams.get('filter') ?? undefined;
  const ticket_number = searchParams.get('ticket_number') ?? undefined;

  const { mutate: runDeleteTicket } = useDeleteTicket();

  const handleDeleteTicket = () => {
    runDeleteTicket(ticket_number, {
      onSuccess: () => {
        const next = new URLSearchParams(searchParams); // ✅ crear nuevo
        next.delete('ticket_number');
        setSearchParams(next, { replace: true }); // ✅ asegura navegación sin push

        toast.success('Ticket eliminado correctamente');
      },
      onError: () => {
        toast.error('Ocurrió un error al eliminar el ticket, intente nuevamente');
      },
    });
  };

  return (
    <PageWrapper>
      <HeaderSection title={'Revisar Tickets'} className={'w-full sticky top-0'} />
      <FlexCol className={'1440:py-[36px] py-2 sm:py-4 flex-1'}>
        <FlexCol className={'sm:flex sm:flex-row gap-2 sm:gap-8'}>
          <FlexCol>
            <FormHeaderFilter />

            <Flex className={'w-full justify-between 1440:py-8 py-3 border-t gap-2 flex-col sm:flex-row'}>
              <IconButton
                label="Eliminar Ticket"
                icon={<TicketX />}
                variant="destructive"
                disabled={!ticket_number}
                onClick={handleDeleteTicket}
              />
              <IconButton label="Cerrar" variant="outline" />
            </Flex>
          </FlexCol>
          <FlexCol>
            <TableTerminalTicket
              user_id={cashier_id}
              date={date}
              winner={filter === 'winner' ? true : undefined}
              paid={filter === 'paid' ? true : undefined}
              not_paid={filter === 'not_paid' ? true : undefined}
            />
          </FlexCol>
        </FlexCol>
        <TicketDetails />
      
      </FlexCol>
    </PageWrapper>
  );
};
