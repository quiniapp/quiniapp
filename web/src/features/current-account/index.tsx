import Box from '@/components/box';
import { Button } from '@/components/ui/button';
import HeaderSection from '@/components/header-section';
import SettlementPayrollTable from '@/components/settlement-payroll-table';

import IsRoleCashier from '@/components/is-role-cashier';
import { useCalculateCurrentAccount } from '@/hooks/mutations/current-account/useCalculateCurrentAccount';
import { useSearchParams } from 'react-router-dom';

import toast from 'react-hot-toast';
import { USER_TYPE } from '@helper/types/user.type';
import CurrentAcoountByUserTable from './CurrentAcoountByUserTable';
import React, { Suspense, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { betsKey, fetchBets } from '@/hooks/fetchs/plays/useBets';
import {
  currentAccountKey,
  fetchCurrentAccount,
} from '@/hooks/fetchs/current-account/useGetCurrentAccount';
import dayjs from 'dayjs';
import { useAuth } from '@/contexts/AuthContext';
import { downloadCurrentAccountTablePDF } from '@/functions/printLiquidationAdmin';
import { printUserSlipPDF } from '@/functions/printLiquidationCashier';
import { PageWrapper } from '@/components/wrapper/PageWrapper';

const CurrentAccountContent = () => {
  const queryClient = useQueryClient();
  const [open, setOpen] = useState<boolean>(false);
  const [openPrintTotals, setOpenPrintTotals] = useState<boolean>(false);
  const [printTotalsKey, setPrintTotalsKey] = useState(0);
  const [openDailySummary, setOpenDailySummary] = useState<boolean>(false);
  const [dailySummaryKey, setDailySummaryKey] = useState(0);
  const [openSubtotals, setOpenSubtotals] = useState<boolean>(false);
  const [subtotalsKey, setSubtotalsKey] = useState(0);
  const { role } = useAuth();
  const [searchParams] = useSearchParams();
  const { mutate: calculateCurrentAccount } = useCalculateCurrentAccount();
  const [printing, setPrinting] = useState(false);
  const date = searchParams.get('date'); // puede ser null: backend devuelve la última
  const group_id = searchParams.get('group_id');

  const handleUpdateCurrentAccount = () => {
    calculateCurrentAccount(searchParams.get('date'), {
      onSuccess: () => {
        toast.success('Cuenta corriente actualizada correctamente');
      },
      onError: () => {
        toast.error('Error al actualizar la cuenta corriente');
      },
    });
  };

  const handleGenerateLiquidation = () => {
    setOpen(true);
  };
  const handlePrintLiquidationCashier = async () => {
    try {
      setPrinting(true);

      // 1) Traer cuentas (caché o fetch)
      const accounts = await queryClient.fetchQuery({
        queryKey: currentAccountKey(date),
        queryFn: () => fetchCurrentAccount(date),
      });

      if (!accounts?.length) {
        toast.error('No hay cuentas a liquidar.');
        return;
      }

      // 2) Por cada cuenta, traer bets (SIN hooks) y generar PDF
      for (const acc of accounts) {
        const bKey = betsKey({
          date: acc.date,
          cashier_id: acc.user_id,
          winners: 'true',
        });

        const bets = await queryClient.fetchQuery({
          queryKey: bKey,
          queryFn: () =>
            fetchBets({
              date: acc.date,
              cashier_id: acc.user_id,
              winners: 'true',
            }),
        });

        await printUserSlipPDF({
          account: acc,
          date: acc.date,
          bets,
        });
      }

      toast.success('Liquidaciones exportadas.');
    } catch (e) {
      console.error(e);
      toast.error('Error exportando liquidaciones.');
    } finally {
      setPrinting(false);
    }
  };

  const handlePrintDiaryLiquidation = async () => {
    try {
      setPrinting(true);
      const rows = await queryClient.fetchQuery({
        queryKey: currentAccountKey(date),
        queryFn: () => fetchCurrentAccount(date),
      });

      if (!rows?.length) {
        toast.error('No hay datos para exportar.');
        return;
      }

      await downloadCurrentAccountTablePDF({
        data: rows,
        date: rows[0]?.date ?? dayjs().format('YYYY-MM-DD'),
      });
    } catch (e) {
      console.error(e);
      toast.error('No se pudo generar el PDF.');
    } finally {
      setPrinting(false);
    }
  };

  if (role === USER_TYPE.CASHIER) return <CurrentAcoountByUserTable />;
  return (
    <PageWrapper>
      <HeaderSection title={'Cuenta Corriente'}>
        <IsRoleCashier role={role}>
          <Box className={'grid grid-cols-2 gap-4'}>
            <Button onClick={handlePrintDiaryLiquidation} disabled={printing}>
              Exportar Diario
            </Button>
            <Button variant="outline" onClick={handlePrintLiquidationCashier} disabled={printing}>
              Exportar Liquidación
            </Button>
            <Button variant={'outline'} onClick={() => { setPrintTotalsKey((k) => k + 1); setOpenPrintTotals(true); }} disabled={printing}>
              Exportar Cobros y Pagos
            </Button>
            <Button variant={'outline'} onClick={() => { setDailySummaryKey((k) => k + 1); setOpenDailySummary(true); }} disabled={printing}>
              Resumen Cuenta Corriente
            </Button>
            <Button variant={'outline'} onClick={() => { setSubtotalsKey((k) => k + 1); setOpenSubtotals(true); }} disabled={printing}>
              Exportar subtotales
            </Button>
            {role !== USER_TYPE.ADMIN && (
              <Button variant={'outline'} onClick={handleGenerateLiquidation}>
                Generar Liquidación
              </Button>
            )}
            <Button variant={'outline'} onClick={handleUpdateCurrentAccount}>
              Actualizar
            </Button>
          </Box>
        </IsRoleCashier>
      </HeaderSection>
      <SettlementPayrollTable />
      <Suspense>
        <GenerateLiquitationModal isOpen={open} onClose={() => setOpen(false)} />
      </Suspense>
      <Suspense>
        <PrintTotalsModal
          key={printTotalsKey}
          isOpen={openPrintTotals}
          onClose={() => setOpenPrintTotals(false)}
          initialDate={date}
          initialGroupId={group_id}
        />
      </Suspense>
      <Suspense>
        <PrintDailySummaryModal
          key={dailySummaryKey}
          isOpen={openDailySummary}
          onClose={() => setOpenDailySummary(false)}
          initialDate={date}
          initialGroupId={group_id}
        />
      </Suspense>
      <Suspense>
        <PrintSubtotalsModal
          key={subtotalsKey}
          isOpen={openSubtotals}
          onClose={() => setOpenSubtotals(false)}
          initialDate={date}
          initialGroupId={group_id}
        />
      </Suspense>
    </PageWrapper>
  );
};

export default CurrentAccountContent;

const GenerateLiquitationModal = React.lazy(
  () => import('../../components/modals/GenerateLiquitationModal')
);

const PrintTotalsModal = React.lazy(
  () => import('../../components/modals/PrintTotalsModal')
);

const PrintDailySummaryModal = React.lazy(
  () => import('../../components/modals/PrintDailySummaryModal')
);

const PrintSubtotalsModal = React.lazy(
  () => import('../../components/modals/PrintSubtotalsModal')
);
