import { TicketX } from 'lucide-react';

import Box from '@/components/box';
import { Flex, FlexCol } from '@/components/flex';
import HeaderSection from '@/components/header-section';
import { Typography } from '@/components/typography';
import { Button } from '@/components/ui/button';
import FormHeaderFilter from '@/features/terminal-ticket/form-header-filter';
import TableTerminalTicket from '@/features/terminal-ticket/table-terminal-ticket.tsx';
import TerminalTicketPlayTable from '@/features/terminal-ticket/termina-ticket-play-table.tsx';
import TerminalTicketMatchesTable from '@/features/terminal-ticket/terminal-ticket-matches-table.tsx';
import { useTickets } from '@/hooks/useTickets.ts';
import { useBets } from '@/hooks/useBets.ts';
import { useLotteries } from '@/hooks/useLotteries.ts';
import { useSchedules } from '@/hooks/useSchedules.ts';

export const TerminalTicketContent = () => {

  const { data } = useTickets()
  const {data:bet } = useBets()
  const {data: lottery} = useLotteries()
  const { data: schedule } = useSchedules();
  console.log({ 'data':data, 'bet':bet, 'lottery':lottery, 'schedule': schedule })


  return (
    <Box className={'grid grid-rows-[auto_1fr_auto] h-full '}>
      <HeaderSection title={'Revisar Tickets'} className={'w-full sticky top-0'} />
      <FlexCol className={'1440:py-[36px] py-[16px]'}>
        <Flex className={'gap-8'}>

        <FormHeaderFilter />
        <FlexCol>
          <FlexCol>
            <TableTerminalTicket />
            <Typography className={'text-xs'} variant={'p'}> Cantidad de Tickets: 6</Typography>
          </FlexCol>

        </FlexCol>

        </Flex>
        <Flex className={'1440:py-8 py-3 space-x-8 '}>
          <FlexCol className={'flex-1  space-y-4'}>
            <p> Jugadas</p>
            <TerminalTicketPlayTable />
            <Flex className={'text-right items-end justify-end'}>Total Jugadas: 1500</Flex>
          </FlexCol>
          <FlexCol className={'flex-1 space-y-4'}>
            <p> Aciertos</p>
            <TerminalTicketMatchesTable />
            <Flex className={'text-right items-end justify-end'}>Total Aciertos: 1440</Flex>
          </FlexCol>
        </Flex>
      </FlexCol>
      <Flex className={'w-full justify-between 1440:py-8 py-3 border-t'}>
        <Button variant={'destructive'}>
          <TicketX /> Eliminar Ticket
        </Button>
        <Button variant={'outline'}> Cerrar </Button>
      </Flex>
    </Box>
  );
};
