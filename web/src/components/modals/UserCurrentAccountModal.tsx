import Modal from './custom-modal';
import { Flex, FlexCol } from '../flex';

import { FormProvider, useForm } from 'react-hook-form';
import { ICurrentAccountEntityFront } from '../../../../helper/types/current_account.type';
import dayjs from 'dayjs';
import LabelInputForm from '../molecules/LabelInputForm';
import { useBets } from '@/hooks/fetchs/plays/useBets';
import { useTickets } from '@/hooks/fetchs/tickets/useTickets';

import { Button } from '../ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../ui/table';
import SkeletonList from '../skeletons/skeleton-list';
import { Typography } from '../typography';
import { ITicketEntityFront } from '../../../../helper/types/ticket.type';
import { IBetEntityFront } from '../../../../helper/types/bet.type';
import { useUpdateCurrentAcoount } from '@/hooks/mutations/current-account/useUpdateCurrentAccoutn';

interface UserCurrentAccountModalProps {
  isOpen: boolean;
  onClose: VoidFunction;
  currentAccount?: ICurrentAccountEntityFront;
}

const UserCurrentAccountModal = ({
  isOpen,
  onClose,
  currentAccount,
}: UserCurrentAccountModalProps) => {
  if (!isOpen) return null;
  const methods = useForm<ICurrentAccountEntityFront>({
    values: currentAccount
      ? { ...currentAccount }
      : {
          current_account_id: '',
          user_id: '',
          user_name: '',
          user_number: 0,
          // group_id: "",
          pass: 0, //sp
          successes: 0, // sp
          claims: 0, // sp
          subtotal: 0, // sp
          previous_balance: 0, // sp
          collections: 0, // sp
          paid: 0, // sp
          total: 0, // sp
          drag: 0, // sp
          leave: 0, //deje
          date: '',
          cashier_commission: 0,
          bills: 0,
          revenue: 0, //deja
          previous_drag: 0,
        },
    mode: 'onChange',
  });

  const { handleSubmit } = methods;
  const { data: bets, isLoading: isLoadingBets } = useBets({
    date: currentAccount?.date ?? '',
    cashier_id: currentAccount?.user_id ?? '',
    winners: 'true',
  });
  const { data: tickets, isLoading: isLoadingTickets } = useTickets({
    user_id: currentAccount?.user_id,
    date: currentAccount?.date,
  });

  const { mutate } = useUpdateCurrentAcoount();
  const onSubmit = (values: ICurrentAccountEntityFront) => {
    console.log('Liquidación enviada:', values);
    onClose();
  };

  console.log('ticket', tickets);
  console.log('bets', bets);

  return (
    <Modal
      title={`Liquidar ${currentAccount?.user_name}-${currentAccount?.user_number} del día ${dayjs(currentAccount?.date).format('DD-MM-YYYY')}`}
      isOpen={isOpen}
      onClose={onClose}
      className="flex flex-col items-center !max-w-[980px] w-full m-auto bg-[#060813] pt-[36px]"
    >
      <FormProvider {...methods}>
        <form onSubmit={handleSubmit(onSubmit)} className="w-full">
          <Flex className="justify-center gap-1 sm:gap-3">
            <FlexCol className="items-between pt-2">
              <LabelInputForm<ICurrentAccountEntityFront> name="pass" label="Pase" type="number" />
              <LabelInputForm<ICurrentAccountEntityFront>
                name="cashier_commission"
                label={`Comisión`}
                type="number"
                readOnly
              />
              <LabelInputForm<ICurrentAccountEntityFront>
                name="successes"
                label="Aciertos"
                type="number"
              />
              <LabelInputForm<ICurrentAccountEntityFront>
                name="claims"
                label="Reclamos"
                type="number"
              />
              <LabelInputForm<ICurrentAccountEntityFront>
                name="bills"
                label="Gastos"
                type="number"
              />
              <LabelInputForm<ICurrentAccountEntityFront>
                name="revenue"
                label="Deja"
                type="number"
              />
            </FlexCol>

            <FlexCol className="items-between pt-2">
              <LabelInputForm<ICurrentAccountEntityFront>
                name="previous_balance"
                label="Saldo Anterior"
                type="number"
              />
              <LabelInputForm<ICurrentAccountEntityFront>
                name="collections"
                label="Cobro al pasador"
                type="number"
              />
              <LabelInputForm<ICurrentAccountEntityFront>
                name="paid"
                label="Pago al pasador"
                type="number"
              />
              <LabelInputForm<ICurrentAccountEntityFront>
                name="previous_drag"
                label="Arrastre anterior"
                type="number"
              />
              <LabelInputForm<ICurrentAccountEntityFront>
                name="drag"
                label="Arrastre nuevo"
                type="number"
              />
              <LabelInputForm<ICurrentAccountEntityFront> name="leave" label="Deje" type="number" />
            </FlexCol>
          </Flex>

          <Flex className="h-60 gap-1 sm:gap-3 ">
            <FlexCol>
              <span className="text-nowrap">Tickets a liquidar</span>
              <Table className="overflow-hidden">
                <TableHeader className="border overflow-hidden">
                  <TableRow>
                    <TableHead>Número </TableHead>
                    <TableHead>Monto </TableHead>
                    <TableHead>Liquidar</TableHead>
                  </TableRow>
                </TableHeader>

                <TableBody className="border">
                  {isLoadingTickets ? (
                    <TableRow>
                      <TableCell colSpan={3}>
                        <SkeletonList />
                      </TableCell>
                    </TableRow>
                  ) : tickets?.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={14} className="text-center">
                        <FlexCol className="items-center justify-center gap-1">
                          <Typography variant="large">No se encontraron tickets</Typography>
                        </FlexCol>
                      </TableCell>
                    </TableRow>
                  ) : (
                    tickets?.map((ticket: ITicketEntityFront) => (
                      <TableRow key={ticket.ticket_id}>
                        <TableCell>{ticket.ticket_number}</TableCell>
                        <TableCell>{ticket.total}</TableCell>
                        <TableCell>Liquidar</TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </FlexCol>
            <FlexCol>
              <span className="text-nowrap">Aciertos a liquidar</span>
              <Table className="overflow-hidden">
                <TableHeader className="border overflow-hidden">
                  <TableRow>
                    <TableHead>Jugada </TableHead>
                    <TableHead>Monto</TableHead>
                    <TableHead>Tipo</TableHead>
                    <TableHead>Quiniela </TableHead>
                    <TableHead>Turno</TableHead>
                    <TableHead>Aciertos</TableHead>
                    <TableHead>Premio</TableHead>
                  </TableRow>
                </TableHeader>

                <TableBody className="border">
                  {isLoadingBets ? (
                    <TableRow>
                      <TableCell colSpan={3}>
                        <SkeletonList />
                      </TableCell>
                    </TableRow>
                  ) : bets?.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={14} className="text-center">
                        <FlexCol className="items-center justify-center gap-1">
                          <Typography variant="large">
                            No se encontraron jugadas ganadoras
                          </Typography>
                        </FlexCol>
                      </TableCell>
                    </TableRow>
                  ) : (
                    bets?.map((bet: IBetEntityFront) => (
                      <TableRow key={bet.ticket_id}>
                        <TableCell>{bet.number}</TableCell>
                        <TableCell>{bet.amount}</TableCell>
                        <TableCell>{bet.place}</TableCell>
                        <TableCell>{bet.lottery.name}</TableCell>
                        <TableCell>{bet.schedule.name}</TableCell>
                        <TableCell>{bet.hits}</TableCell>
                        <TableCell>{bet.prize}</TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </FlexCol>
          </Flex>
          <Flex className="justify-center gap-2 mt-6">
            <Button
              type="submit"
              className="p-1 sm:p-3 uppercase  text-xs sm:text-base"
              variant={'success'}
            >
              Generar Liquidación
            </Button>
            <Button
              type="button"
              onClick={onClose}
              className="p-1 sm:p-3 text-xs sm:text-base"
              variant={'destructive'}
            >
              Cancelar
            </Button>
          </Flex>
        </form>
      </FormProvider>
    </Modal>
  );
};

export default UserCurrentAccountModal;
