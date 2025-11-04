import Box from '@/components/box';
import { Button } from '@/components/ui/button';
import HeaderSection from '@/components/header-section';
import SettlementPayrollTable from '@/components/settlement-payroll-table';

import IsRoleCashier from '@/components/is-role-cashier';
import { useUpdateCurrentAcoount } from '@/hooks/mutations/current-account/useUpdateCurrentAccoutn';
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
  const { role } = useAuth();
  const [searchParams] = useSearchParams();
  const { mutate } = useUpdateCurrentAcoount();
  const [printing, setPrinting] = useState(false);
  const date = searchParams.get('date'); // puede ser null: backend devuelve la última

  const handleUpdateCurrentAccount = () => {
    mutate(searchParams.get('date'), {
      onSuccess: () => {
        toast.success('Actualizado correctamente');
      },
      onError: () => {
        toast.error('Error al actualizar');
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
            <Button variant={'outline'} onClick={handleUpdateCurrentAccount}>
              Actualizar
            </Button>
            <Button variant={'outline'} onClick={handleGenerateLiquidation}>
              Generar Liquidación
            </Button>
          </Box>
        </IsRoleCashier>
      </HeaderSection>
      <SettlementPayrollTable />
      <Suspense>
        <GenerateLiquitationModal isOpen={open} onClose={() => setOpen(false)} />
      </Suspense>
    </PageWrapper>
  );
};

export default CurrentAccountContent;

const GenerateLiquitationModal = React.lazy(
  () => import('../../components/modals/GenerateLiquitationModal')
);
