import { HandCoinsIcon, TicketX } from 'lucide-react';
import { useState, lazy, Suspense } from 'react';

// @Components
import { IconButton } from '@/components/button/IconButton';
import { Flex, FlexCol } from '@/components/flex';
import HeaderSection from '@/components/header-section';
import FormHeaderFilter from '@/features/terminal-ticket/form-header-filter';
import TableTerminalTicket from '@/features/terminal-ticket/table-terminal-ticket'; // @Hooks

import TicketDetails from './TicketDetails';
import { useNavigate } from 'react-router-dom';
import { useDeleteTicket } from '@/hooks/mutations/tickets/useDeleteTicket';
import toast from 'react-hot-toast';
import { PageWrapper } from '@/components/wrapper/PageWrapper';
import { useAuth } from '@/contexts/AuthContext';
import { USER_TYPE } from '@helper/types/user.type';
import { TerminalTicketProvider, useTerminalTicket } from './provider/TerminalTicketProvider';
import { usePaidTicket } from '@/hooks/mutations/tickets/usePayTicket';

// Lazy load modals
const DeleteTicketModal = lazy(() => import('@/components/modals/DeleteTicketModal'));
const PayTicketModal = lazy(() => import('@/components/modals/PayTicketModal'));

const TerminalTicketContentInner = () => {
  const { role } = useAuth();
  const { date, cashier_id, group_id, winner, paid, not_paid, ticket_number, resetTicketNumber, payTicket } =
    useTerminalTicket();
  const [isOpenDeleteTicket, setIsOpenDeleteTicket] = useState(false);
  const [isOpenPayTicket, setIsOpenPayTicket] = useState(false);
  const navigate = useNavigate();
  const { mutate: runPayTicket, isPending: isPendingPay } = usePaidTicket();
  const { mutate: runDeleteTicket, isPending: isPendingDelete } = useDeleteTicket();

  const handleDeleteTicket = () => {
    runDeleteTicket(ticket_number, {
      onSuccess: () => {
        resetTicketNumber();
        setIsOpenDeleteTicket(false);
        toast.success('Ticket eliminado correctamente');
      },
      onError: (err) => {
        console.error(err);
        toast.error('Ocurrió un error al eliminar el ticket, intente nuevamente');
      },
    });
  };

  const handlePayTicket = () => {
    runPayTicket(ticket_number, {
      onSuccess: () => {
        resetTicketNumber();
        setIsOpenPayTicket(false);
        toast.success('Ticket pagado correctamente');
      },
      onError: () => {
        toast.error('Ocurrió un error al pagar el ticket, intente nuevamente');
      },
    });
  };

  const handleClose = () => {
    navigate('/');
  };
  return (
    <PageWrapper>
      <HeaderSection title={'Revisar Tickets'} className={'w-full sticky top-0'} />
      <FlexCol className={'1440:py-[36px] py-2 sm:py-4 flex-1'}>
        <FlexCol>
          <FormHeaderFilter />

          <FlexCol>
            <TableTerminalTicket
              user_id={cashier_id}
              date={date}
              winner={winner}
              paid={paid}
              not_paid={not_paid}
              group_id={group_id}
            />
            <Flex className={'w-full justify-between 1440:py-8 py-3 border-t gap-2'}>
              <Flex className="gap-1 sm:gap-2 2xl:gap-4">
                <IconButton
                  label="Eliminar Ticket"
                  icon={<TicketX />}
                  variant="destructive"
                  disabled={!ticket_number}
                  onClick={() => setIsOpenDeleteTicket(true)}
                />
                {role === USER_TYPE.CASHIER && (
                  <IconButton
                    label="Pagar ticket"
                    icon={<HandCoinsIcon />}
                    variant="success"
                    disabled={!ticket_number || !payTicket}
                    onClick={() => setIsOpenPayTicket(true)}
                  />
                )}
              </Flex>
              <IconButton label="Cerrar" variant="outline" onClick={() => handleClose()} />
            </Flex>
          </FlexCol>
        </FlexCol>
        <TicketDetails />
      </FlexCol>

      <Suspense fallback={null}>
        <DeleteTicketModal
          isOpen={isOpenDeleteTicket}
          ticketNumber={ticket_number}
          onClose={() => setIsOpenDeleteTicket(false)}
          onClick={handleDeleteTicket}
          isPendingDelete={isPendingDelete}
        />
      </Suspense>

      <Suspense fallback={null}>
        <PayTicketModal
          isOpen={isOpenPayTicket}
          ticketNumber={ticket_number}
          onClose={() => setIsOpenPayTicket(false)}
          onClick={handlePayTicket}
          isPendingDelete={isPendingPay}
        />
      </Suspense>
    </PageWrapper>
  );
};

export const TerminalTicketContent = () => {
  return (
    <TerminalTicketProvider>
      <TerminalTicketContentInner />
    </TerminalTicketProvider>
  );
};
