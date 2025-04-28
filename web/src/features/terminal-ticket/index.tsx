import { TicketX } from 'lucide-react';

import FormHeaderFilter from '@/features/terminal-ticket/form-header-filter';

import Box from '@/components/box';
import { Button } from '@/components/ui/button';
import { Flex, FlexCol } from '@/components/flex';
import HeaderSection from '@/components/header-section';
import TableTerminalTicket from '@/features/terminal-ticket/table-terminal-ticket.tsx';

export const TerminalTicketContent = () => {
  return (
    <Box className={'grid grid-rows-[auto_1fr_auto] h-full '}>
      <HeaderSection title={'Revisar Tickets'} className={'w-full sticky top-0'} />
      <FlexCol className={'1400:py-[36px] py-[16px]'}>
        <FormHeaderFilter />
      <FlexCol>
        <FlexCol>
          <TableTerminalTicket />
          <p> Cantidad de Tickets: 6</p>
        </FlexCol>
        <Flex className={'py-8 space-x-8 '}>
          <FlexCol className={'flex-1 '}>
            <p> Jugadas</p>
            <div> tabla </div>
            <Flex className={'text-right items-end justify-end'}>Total Jugadas: 1500</Flex>
          </FlexCol>
          <FlexCol className={'flex-1 '}>
            <p> Aciertos</p>
            <div> tabla</div>
            <Flex className={'text-right items-end justify-end'}>Total Aciertos: 1400</Flex>
          </FlexCol>
        </Flex>
      </FlexCol>
      <Flex className={'w-full justify-between py-8 border-t'}>
        <Button variant={'destructive'}>
          <TicketX /> Eliminar Ticket
        </Button>
        <Button variant={'outline'}> Cerrar </Button>
      </Flex>
      </FlexCol>
    </Box>
  );
};
