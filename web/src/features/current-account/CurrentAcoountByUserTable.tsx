import { Flex, FlexCol } from '@/components/flex';
import LabelInputForm from '@/components/molecules/LabelInputForm';

import { ICurrentAccountEntityFront } from '../../../../helper/types/current_account.type';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import SkeletonList from '@/components/skeletons/skeleton-list';
import { Typography } from '@/components/typography';
import { ITicketEntityFront } from '../../../../helper/types/ticket.type';
import { IBetEntityFront } from '../../../../helper/types/bet.type';
import { betPlaceDictionary } from '../../../../helper/functions/betPlaceDictionary';
import { useBets } from '@/hooks/fetchs/plays/useBets';
import { useTickets } from '@/hooks/fetchs/tickets/useTickets';
import dayjs from 'dayjs';
import { useSessionStore } from '@/stores/sessionStore';
import { FormProvider, useForm } from 'react-hook-form';
import { useEffect, useState } from 'react';
import { useGetCurrentAccount } from '@/hooks/fetchs/current-account/useGetCurrentAccount';
import { useSearchParams } from 'react-router-dom';
import { printUserSlipPDF } from '../../../helper/function/printLiquidationCashier';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { SelectDayToSearch } from '../plays-and-hits/select-day-to-search';

const CurrentAcoountByUserTable = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const [printing, setPrinting] = useState<boolean>(false);
  const today = dayjs().format('YYYY-MM-DD');
  const date = searchParams.get('date') ?? today;
  const { user } = useSessionStore();

  const methods = useForm<ICurrentAccountEntityFront>({
    defaultValues: {
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
  });

  const { data: currentAccount } = useGetCurrentAccount(date);
  const { data: bets, isLoading: isLoadingBets } = useBets({
    date: date,
    cashier_id: user?.user_id,
    winners: 'true',
  });
  const { data: tickets, isLoading: isLoadingTickets } = useTickets({
    user_id: user?.user_id,
    date: date,
  });

  const handlePrintLiquidationCashier = async () => {
    if (currentAccount?.length) {
      setPrinting(true);
      await printUserSlipPDF({
        account: currentAccount?.[0],
        date: date,
        bets,
      });
      setPrinting(false);
    }
  };
  const handleDayChange = (newDate?: string) => {
    if (!newDate) return;
    const params = new URLSearchParams(searchParams);
    params.set('date', newDate);
    setSearchParams(params);
  };
  useEffect(() => {
    if (currentAccount?.length) methods.reset(currentAccount[0]);
  }, [currentAccount]);
  return (
    <FlexCol className="items-center justify-center !max-w-[980px] w-full m-auto bg-[#060813] pt-[36px]">
      <Flex className="w-full gap-1 sm:gap-3">
        <Button variant="outline" onClick={handlePrintLiquidationCashier} disabled={printing}>
          Exportar Liquidación
        </Button>
        <Flex className="items-center">
          <Label className="text-sm mr-2 text-muted-foreground">A la Fecha:</Label>
          <SelectDayToSearch
            selectedDay={date}
            onDayChange={handleDayChange}
            toDate={dayjs().toDate()}
          />
        </Flex>
      </Flex>

      <Typography variant="large">{`Fecha de Liquidación: ${dayjs(currentAccount?.[0]?.date).format('DD-MM-YYYY')}`}</Typography>
      <FormProvider {...methods}>
        <form className="w-full">
          <Flex className="justify-center gap-1 sm:gap-3">
            <FlexCol className="items-between pt-2">
              <LabelInputForm<ICurrentAccountEntityFront>
                name="pass"
                label="Pase"
                type="number"
                disabled={true}
              />
              <LabelInputForm<ICurrentAccountEntityFront>
                name="cashier_commission"
                label={`Comisión`}
                type="number"
                disabled={true}
              />
              <LabelInputForm<ICurrentAccountEntityFront>
                name="successes"
                label="Aciertos"
                type="number"
                disabled={true}
              />
              <LabelInputForm<ICurrentAccountEntityFront>
                name="claims"
                label="Reclamos"
                type="number"
                disabled={true}
              />
              <LabelInputForm<ICurrentAccountEntityFront>
                name="bills"
                label="Gastos"
                type="number"
                disabled={true}
              />
              <LabelInputForm<ICurrentAccountEntityFront>
                name="revenue"
                label="Deja"
                type="number"
                disabled={true}
              />
            </FlexCol>

            <FlexCol className="items-between pt-2">
              <LabelInputForm<ICurrentAccountEntityFront>
                name="previous_balance"
                label="Saldo Anterior"
                type="number"
                disabled={true}
              />
              <LabelInputForm<ICurrentAccountEntityFront>
                name="collections"
                label="Cobro al pasador"
                type="number"
                disabled={true}
              />
              <LabelInputForm<ICurrentAccountEntityFront>
                name="paid"
                label="Pago al pasador"
                type="number"
                disabled={true}
              />
              <LabelInputForm<ICurrentAccountEntityFront>
                name="previous_drag"
                label="Arrastre anterior"
                type="number"
                disabled={true}
              />
              <LabelInputForm<ICurrentAccountEntityFront>
                name="drag"
                label="Arrastre nuevo"
                type="number"
                disabled={true}
              />
              <LabelInputForm<ICurrentAccountEntityFront>
                name="leave"
                label="Deje"
                type="number"
                disabled={true}
              />
            </FlexCol>
          </Flex>

          <Flex className="h-60 gap-1 sm:gap-3 items-center justify-center">
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
            </FlexCol>
          </Flex>
        </form>
      </FormProvider>
    </FlexCol>
  );
};

export default CurrentAcoountByUserTable;
