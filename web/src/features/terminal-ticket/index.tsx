import { TicketX } from 'lucide-react';

// @Components
import Box from '@/components/box';
import { Button } from '@/components/ui/button';
import { Flex, FlexCol } from '@/components/flex';
import { Typography } from '@/components/typography';
import HeaderSection from '@/components/header-section';
import FormHeaderFilter from '@/features/terminal-ticket/form-header-filter';
import TableTerminalTicket from '@/features/terminal-ticket/table-terminal-ticket'; // @Hooks

import { useTickets } from '@/hooks/fetchs/tickets/useTickets';

import TicketDetails from './TicketDetails';
import { useSearchParams } from 'react-router-dom';
import { useDeleteTicket } from '@/hooks/mutations/tickets/useDeleteTicket';
import toast from 'react-hot-toast';

export const TerminalTicketContent = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const date = searchParams.get('date') ?? undefined;
  const cashier_id = searchParams.get('cashier_id') ?? undefined;
  const filter = searchParams.get('filter') ?? undefined;
  const ticket_number = searchParams.get('ticket_number') ?? undefined;
  const { data } = useTickets({
    date: date,
    user_id: cashier_id,
    winner: filter === 'winner' ? true : undefined,
  });
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
    <Box className={'grid grid-rows-[auto_1fr_auto] h-full '}>
      <HeaderSection title={'Revisar Tickets'} className={'w-full sticky top-0'} />
      <FlexCol className={'1440:py-[36px] py-[16px]'}>
        <Flex className={'gap-8'}>
          <FormHeaderFilter />
          <FlexCol>
            <FlexCol>
              <TableTerminalTicket data={data} />

              <Typography className={'text-xs'} variant={'p'}>
                Cantidad de Tickets: {data?.length}
              </Typography>
            </FlexCol>
          </FlexCol>
        </Flex>
        <TicketDetails />
      </FlexCol>
      <Flex className={'w-full justify-between 1440:py-8 py-3 border-t'}>
        <Button variant={'destructive'} disabled={!ticket_number} onClick={handleDeleteTicket}>
          <TicketX /> Eliminar Ticket
        </Button>
        <Button variant={'outline'}> Cerrar </Button>
      </Flex>
    </Box>
  );
};
