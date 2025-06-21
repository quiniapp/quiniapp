import { TicketX } from 'lucide-react';

// @Components
import Box from '@/components/box';
import { Button } from '@/components/ui/button';
import { Flex, FlexCol } from '@/components/flex';
import { Typography } from '@/components/typography';
import HeaderSection from '@/components/header-section';
import FormHeaderFilter from '@/features/terminal-ticket/form-header-filter';
import TableTerminalTicket from '@/features/terminal-ticket/table-terminal-ticket';
import TerminalTicketPlayTable from '@/features/terminal-ticket/termina-ticket-play-table';
import TerminalTicketMatchesTable from '@/features/terminal-ticket/terminal-ticket-matches-table';
// @Hooks

import useTerminalTicketHook from '@/hooks/use-terminal-ticket-hook.ts';

export const TerminalTicketContent = () => {
  const {
    data,
    selectedBets,
    winningBets,
    filteredTickets,
    selectedTicket,
    handleSearchByTicketNumber,
    handleTicketClick,
    handleResetFilters,
    handleChangeFilter,
    handleDeleteTicket,
  } = useTerminalTicketHook();


  return (
    <Box className={'grid grid-rows-[auto_1fr_auto] h-full '}>
      <HeaderSection title={'Revisar Tickets'} className={'w-full sticky top-0'} />
      <FlexCol className={'1440:py-[36px] py-[16px]'}>
        <Flex className={'gap-8'}>
          <FormHeaderFilter
            onSearchByTicketNumber={handleSearchByTicketNumber}
            onResetFilters={handleResetFilters}
            onChangeFilter={handleChangeFilter}
          />
          <FlexCol>
            <FlexCol>
              <TableTerminalTicket data={filteredTickets} onTicketClick={handleTicketClick} />

              <Typography className={'text-xs'} variant={'p'}>
                Cantidad de Tickets: {data?.data?.ticket.length}
              </Typography>
            </FlexCol>
          </FlexCol>
        </Flex>
        <Flex className={'1440:py-8 py-3 space-x-8 '}>
          <FlexCol className={'flex-1  space-y-4'}>
            <p> Jugadas</p>
            <TerminalTicketPlayTable bets={selectedBets} />
          </FlexCol>
          <FlexCol className={'flex-1 space-y-4'}>
            <p> Aciertos</p>
            <TerminalTicketMatchesTable bets={winningBets} />
          </FlexCol>
        </Flex>
      </FlexCol>
      <Flex className={'w-full justify-between 1440:py-8 py-3 border-t'}>
        <Button
          variant={'destructive'}
          onClick={handleDeleteTicket}
          disabled={!selectedTicket}
        >
          <TicketX /> Eliminar Ticket
        </Button>
        <Button variant={'outline'}> Cerrar </Button>
      </Flex>
    </Box>
  );
};
