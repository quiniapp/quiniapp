import { Flex, FlexCol } from '@/components/flex';
import LabelInputForm from '@/components/molecules/LabelInputForm';
import { ICurrentAccountEntityFront } from '@helper/types/current_account.type';
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
import { ITicketEntityFront } from '@helper/types/ticket.type';
import { IBetEntityFront } from '@helper/types/bet.type';
import { betPlaceDictionary } from '@helper/functions/betPlaceDictionary';
import { useBets } from '@/hooks/fetchs/plays/useBets';
import { useTickets } from '@/hooks/fetchs/tickets/useTickets';
import dayjs from 'dayjs';
import { FormProvider, useForm } from 'react-hook-form';
import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { SelectDayToSearch } from '@/components/button/SelectDayToSearch';
import { useGetCurrentAccountByUser } from '@/hooks/fetchs/current-account/useGetCurrentAccountByUser';
import { useAuth } from '@/contexts/AuthContext';
import { printUserSlipPDF } from '@/functions/printLiquidationCashier';
import { PageWrapper } from '@/components/wrapper/PageWrapper';
const money = (n?: number | null) =>
  Number(n ?? 0).toLocaleString('es-AR', { minimumFractionDigits: 0, maximumFractionDigits: 0 });

const CurrentAcoountByUserTable = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const [printing, setPrinting] = useState<boolean>(false);
  const today = dayjs().format('YYYY-MM-DD');
  const date = searchParams.get('date');
  const { user } = useAuth();

  const methods = useForm<ICurrentAccountEntityFront>({
    defaultValues: {
      current_account_id: '',
      user_id: '',
      user_name: '',
      user_number: 0,
      pass: 0,
      successes: 0,
      claims: 0,
      subtotal: 0,
      previous_balance: 0,
      collections: 0,
      paid: 0,
      total: 0,
      drag: 0,
      leave: 0,
      date: '',
      cashier_commission: 0,
      bills: 0,
      revenue: 0,
      previous_drag: 0,
    },
  });

  const { data: currentAccount } = useGetCurrentAccountByUser(user?.user_id, date);

  const { data: bets, isLoading: isLoadingBets } = useBets({
    date: currentAccount?.date ?? null,
    cashier_id: user?.user_id,
    winners: 'true',
  });
  const { data: tickets, isLoading: isLoadingTickets } = useTickets({
    user_id: user?.user_id,
    date: currentAccount?.date,
  });

  const handlePrintLiquidationCashier = async () => {
    if (currentAccount) {
      setPrinting(true);
      await printUserSlipPDF({
        account: currentAccount,
        date: currentAccount?.date,
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
    if (currentAccount) methods.reset(currentAccount);
  }, [currentAccount]);

  return (
    <PageWrapper>
      {/* Header responsive */}
      <Flex
        className={
          // en mobile apilado y full width
          'w-full gap-2 sm:gap-3 max-sm:flex-col max-sm:px-3'
        }
      >
        <Button
          variant="outline"
          onClick={handlePrintLiquidationCashier}
          disabled={printing}
          className="w-full sm:w-auto" // ⬅️ full width en mobile
        >
          Exportar Liquidación
        </Button>

        <Flex className="items-center max-sm:flex-col max-sm:items-start w-full sm:w-auto">
          <Label className="text-sm mr-2 text-muted-foreground max-sm:mb-1">A la Fecha:</Label>
          <SelectDayToSearch
            selectedDay={date ?? today}
            onDayChange={handleDayChange}
            toDate={dayjs().toDate()}
          />
        </Flex>
      </Flex>

      <Typography className="mt-3 px-3 sm:px-0" variant="large">
        {`Fecha de Liquidación: ${dayjs(currentAccount?.date).format('DD-MM-YYYY')}`}
      </Typography>

      <FormProvider {...methods}>
        <form className="w-full">
          {/* Inputs: de dos columnas a una en mobile */}
          <Flex className={'justify-center gap-3 sm:gap-6 mt-2 px-3 sm:px-0 ' + 'max-sm:flex-col'}>
            <FlexCol className="items-between pt-2 gap-2">
              <LabelInputForm<ICurrentAccountEntityFront>
                name="pass"
                label="Pase"
                type="number"
                disabled
              />
              <LabelInputForm<ICurrentAccountEntityFront>
                name="cashier_commission"
                label="Comisión"
                type="number"
                disabled
              />
              <LabelInputForm<ICurrentAccountEntityFront>
                name="successes"
                label="Aciertos"
                type="number"
                disabled
              />
              <LabelInputForm<ICurrentAccountEntityFront>
                name="claims"
                label="Reclamos"
                type="number"
                disabled
              />
              <LabelInputForm<ICurrentAccountEntityFront>
                name="bills"
                label="Gastos"
                type="number"
                disabled
              />
              <LabelInputForm<ICurrentAccountEntityFront>
                name="revenue"
                label="Deja"
                type="number"
                disabled
              />
            </FlexCol>

            <FlexCol className="items-between pt-2 gap-2">
              <LabelInputForm<ICurrentAccountEntityFront>
                name="previous_balance"
                label="Saldo Anterior"
                type="number"
                disabled
              />
              <LabelInputForm<ICurrentAccountEntityFront>
                name="collections"
                label="Cobro al pasador"
                type="number"
                disabled
              />
              <LabelInputForm<ICurrentAccountEntityFront>
                name="paid"
                label="Pago al pasador"
                type="number"
                disabled
              />
              <LabelInputForm<ICurrentAccountEntityFront>
                name="previous_drag"
                label="Arrastre anterior"
                type="number"
                disabled
              />
              <LabelInputForm<ICurrentAccountEntityFront>
                name="drag"
                label="Arrastre nuevo"
                type="number"
                disabled
              />
              <LabelInputForm<ICurrentAccountEntityFront>
                name="leave"
                label="Deje"
                type="number"
                disabled
              />
            </FlexCol>
          </Flex>
          <Flex className="p-1 gap-1 sm:gap-4 items-center justify-center">
            <Label className="text-white text-center text-nowrap text-base sm:text-lg uppercase font-bold">
              {`${methods.getValues('total') > 0 ? 'Debe' : 'Cobra'}: $ ${money(Math.abs(methods.getValues('total')))}`}
            </Label>
          </Flex>
          {/* Listas: tablas en desktop, tarjetas en mobile */}
          <Flex className="flex-col sm:flex-row gap-3 sm:gap-6 items-start justify-center mt-4 px-3 sm:px-0">
            {/* -------- Tickets a liquidar -------- */}
            <FlexCol className="w-full sm:w-auto">
              <span className="text-nowrap mb-2">Tickets a liquidar</span>

              {/* Mobile cards (≤640) */}
              <div className="sm:hidden space-y-2">
                {isLoadingTickets ? (
                  <SkeletonList />
                ) : tickets?.length === 0 ? (
                  <div className="text-center py-4 rounded-md border border-dashed">
                    <Typography variant="large">No se encontraron tickets</Typography>
                  </div>
                ) : (
                  tickets?.map((t: ITicketEntityFront) => (
                    <div key={t.ticket_id} className="rounded-lg border p-3 bg-background/30">
                      <div className="flex justify-between">
                        <span className="text-sm opacity-70">Número</span>
                        <span className="font-medium">{t.ticket_number}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-sm opacity-70">Monto</span>
                        <span className="font-medium">{t.total}</span>
                      </div>
                      <div className="mt-2">
                        <Button size="sm" variant="secondary" className="w-full">
                          Liquidar
                        </Button>
                      </div>
                    </div>
                  ))
                )}
              </div>

              {/* Desktop table (≥640) */}
              <div className="hidden sm:block max-w-[460px]">
                <Table className="overflow-hidden">
                  <TableHeader className="border overflow-hidden">
                    <TableRow>
                      <TableHead>Número</TableHead>
                      <TableHead>Monto</TableHead>
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
                        <TableCell colSpan={3} className="text-center">
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
                          <TableCell>
                            <Button size="sm" variant="secondary">
                              Liquidar
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </div>
            </FlexCol>

            {/* -------- Aciertos a liquidar -------- */}
            <FlexCol className="w-full sm:w-auto">
              <span className="text-nowrap mb-2">Aciertos a liquidar</span>

              {/* Mobile cards */}
              <div className="sm:hidden space-y-2">
                {isLoadingBets ? (
                  <SkeletonList />
                ) : bets?.length === 0 ? (
                  <div className="text-center py-4 rounded-md border border-dashed">
                    <Typography variant="large">No se encontraron jugadas ganadoras</Typography>
                  </div>
                ) : (
                  bets?.map((b: IBetEntityFront) => (
                    <div
                      key={`${b.ticket_id}-${b.number}-${b.lottery?.lottery_id}-${b.schedule?.schedule_id}`}
                      className="rounded-lg border p-3 bg-background/30"
                    >
                      <div className="flex justify-between">
                        <span className="text-sm opacity-70">Jugada</span>
                        <span className="font-medium">{b.number}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-sm opacity-70">Monto</span>
                        <span className="font-medium">{b.amount}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-sm opacity-70">Tipo</span>
                        <span className="font-medium">{betPlaceDictionary[b.place]}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-sm opacity-70">Quiniela</span>
                        <span className="font-medium">{b.lottery.name}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-sm opacity-70">Turno</span>
                        <span className="font-medium">{b.schedule.name}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-sm opacity-70">Aciertos</span>
                        <span className="font-medium">{b.hits}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-sm opacity-70">Premio</span>
                        <span className="font-medium">{b.prize}</span>
                      </div>
                    </div>
                  ))
                )}
              </div>

              {/* Desktop table */}
              <div className="hidden sm:block max-w-[720px] overflow-x-auto">
                <Table className="overflow-hidden">
                  <TableHeader className="border overflow-hidden">
                    <TableRow>
                      <TableHead>Jugada</TableHead>
                      <TableHead>Monto</TableHead>
                      <TableHead>Tipo</TableHead>
                      <TableHead>Quiniela</TableHead>
                      <TableHead>Turno</TableHead>
                      <TableHead>Aciertos</TableHead>
                      <TableHead>Premio</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody className="border">
                    {isLoadingBets ? (
                      <TableRow>
                        <TableCell colSpan={7}>
                          <SkeletonList />
                        </TableCell>
                      </TableRow>
                    ) : bets?.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={7} className="text-center">
                          <FlexCol className="items-center justify-center gap-1">
                            <Typography variant="large">
                              No se encontraron jugadas ganadoras
                            </Typography>
                          </FlexCol>
                        </TableCell>
                      </TableRow>
                    ) : (
                      bets?.map((bet: IBetEntityFront) => (
                        <TableRow
                          key={`${bet.ticket_id}-${bet.number}-${bet.lottery?.lottery_id}-${bet.schedule?.schedule_id}`}
                        >
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
        </form>
      </FormProvider>
    </PageWrapper>
  );
};

export default CurrentAcoountByUserTable;
