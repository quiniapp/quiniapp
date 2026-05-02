import Modal from './custom-modal';
import { Flex, FlexCol } from '../flex';

import { FormProvider, useForm } from 'react-hook-form';
import { ICurrentAccountEntityFront } from '@helper/types/current_account.type';
import { USER_TYPE } from '@helper/types/user.type';
import dayjs from 'dayjs';
import LabelInputForm from '../molecules/LabelInputForm';
import { useBets } from '@/hooks/fetchs/plays/useBets';
import { useTickets } from '@/hooks/fetchs/tickets/useTickets';

import { IconButton } from '../button/IconButton';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../ui/table';
import SkeletonList from '../skeletons/skeleton-list';
import { Text } from '../atoms/Text';
import { ITicketEntityFront } from '@helper/types/ticket.type';
import { IBetEntityFront } from '@helper/types/bet.type';
import { betPlaceDictionary } from '@helper/functions/betPlaceDictionary';
import { useUpdateCurrentAcoountByUser } from '@/hooks/mutations/current-account/useUpdateCurrentAccoutnByUser';
import { Checkbox } from '../ui/checkbox';
import { Label } from '../ui/label';
import { useState } from 'react';
import { useGetUserByNumber } from '@/hooks/fetchs/users/useUsersByNumber';

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
  const [calcLeave, setCalcLeave] = useState<boolean>(false);
  const methods = useForm<ICurrentAccountEntityFront>({
    values: currentAccount
      ? { ...currentAccount }
      : {
          current_account_id: '',
          user_id: '',
          user_name: '',
          user_number: 0,
          group_id: null,
          is_liquidated: false,
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
  const { data: cashier } = useGetUserByNumber(currentAccount?.user_number);
  const { handleSubmit, setValue, getValues } = methods;
  const { data: bets, isLoading: isLoadingBets } = useBets({
    date: currentAccount?.date ?? '',
    cashier_id: currentAccount?.user_id ?? '',
    winners: 'true',
  });
  const { data: tickets, isLoading: isLoadingTickets } = useTickets({
    user_id: currentAccount?.user_id,
    date: currentAccount?.date,
  });

  const { mutate } = useUpdateCurrentAcoountByUser();
  const onSubmit = (values: ICurrentAccountEntityFront) => {

    mutate({
      date: currentAccount?.date ?? '',
      current_account_id: currentAccount?.current_account_id ?? '',
      updateCurrentAccount: values,
      leave: calcLeave,
    });
    onClose();
  };
  const handleCalcLeave = (enable: boolean) => {
    if (enable) {
      setValue('leave', 0);
    } else {
      const feePlus = cashier?.user_type === USER_TYPE.CASHIER ? cashier.fee_plus : 0;
      setValue('leave', getValues('drag') * feePlus / 100);
    }
    setCalcLeave(!enable);
  };

  return (
    <Modal
      title={`Liquidar ${currentAccount?.user_name}-${currentAccount?.user_number} del día ${dayjs(currentAccount?.date).format('DD-MM-YYYY')}`}
      isOpen={isOpen}
      onClose={onClose}
      className="flex flex-col items-center !max-w-[95vw] sm:!max-w-[90vw] md:!max-w-[980px] w-full m-auto bg-[#060813] pt-4 sm:pt-6 md:pt-[36px]"
    >
      <FormProvider {...methods}>
        <form onSubmit={handleSubmit(onSubmit)} className="w-full">
          <Flex className="justify-center gap-1 sm:gap-3 flex-col sm:flex-row">
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
              <Flex className="items-center gap-1 sm:gap-3 px-1 py-1">
                <Checkbox
                  checked={calcLeave}
                  onClick={() => handleCalcLeave(calcLeave)}
                  className="border-white bg-white"
                />
                <Label>Liquidar deje</Label>
              </Flex>
              <LabelInputForm<ICurrentAccountEntityFront> name="leave" label="Deje" type="number" />
            </FlexCol>
          </Flex>

          <Flex className="gap-1 sm:gap-3 flex-col sm:flex-row mt-2">
            <FlexCol className="flex-1 min-w-0">
              <span className="text-nowrap text-sm mb-1">Tickets a liquidar</span>
              <div className="h-48 sm:h-60 overflow-y-auto">
                <Table className="overflow-hidden">
                  <TableHeader className="border overflow-hidden">
                    <TableRow>
                      <TableHead>Número </TableHead>
                      <TableHead>Monto </TableHead>
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
                            <Text size="lg" weight="semibold">No se encontraron tickets</Text>
                          </FlexCol>
                        </TableCell>
                      </TableRow>
                    ) : (
                      tickets?.map((ticket: ITicketEntityFront) => (
                        <TableRow key={ticket.ticket_id}>
                          <TableCell>{ticket.ticket_number}</TableCell>
                          <TableCell>{ticket.total}</TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </div>
            </FlexCol>
            <FlexCol className="flex-1 min-w-0">
              <span className="text-nowrap text-sm mb-1">Aciertos a liquidar</span>
              <div className="h-48 sm:h-60 overflow-y-auto overflow-x-auto">
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
                            <Text size="lg" weight="semibold">
                              No se encontraron jugadas ganadoras
                            </Text>
                          </FlexCol>
                        </TableCell>
                      </TableRow>
                    ) : (
                      bets?.map((bet: IBetEntityFront) => (
                        <TableRow key={bet.ticket_id}>
                          <TableCell>{bet.number}</TableCell>
                          <TableCell>{bet.amount}</TableCell>
                          <TableCell>{betPlaceDictionary[bet.place]}</TableCell>
                          <TableCell>{bet.lottery.name}</TableCell>
                          <TableCell>{bet.schedule.name}</TableCell>
                          <TableCell>{bet.hits}</TableCell>
                          <TableCell>{bet.prize}</TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </div>
            </FlexCol>
          </Flex>
          <Flex className="justify-center gap-2 mt-6 flex-col sm:flex-row w-full px-2 sm:px-4">
            <IconButton
              label="Generar Liquidación"
              type="submit"
              variant="success"
              className="w-full uppercase"
            />
            <IconButton
              label="Cancelar"
              type="button"
              onClick={onClose}
              variant="destructive"
              className="w-full"
            />
          </Flex>
        </form>
      </FormProvider>
    </Modal>
  );
};

export default UserCurrentAccountModal;
