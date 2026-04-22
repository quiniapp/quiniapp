import Box from '@/components/box';
import { Button } from '@/components/ui/button';
import HeaderSection from '@/components/header-section';
import { FileText, FileDown, CreditCard, BarChart2, List, RefreshCw, Wallet } from 'lucide-react';
import SettlementPayrollTable from '@/components/settlement-payroll-table';

import IsRoleCashier from '@/components/is-role-cashier';
import { useCalculateCurrentAccount } from '@/hooks/mutations/current-account/useCalculateCurrentAccount';
import { useSearchParams } from 'react-router-dom';

import toast from 'react-hot-toast';
import { USER_TYPE } from '@helper/types/user.type';
import CurrentAcoountByUserTable from './CurrentAcoountByUserTable';
import React, { Suspense, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/contexts/AuthContext';
import { exportDiario } from './handlers/exportDiario';
import { exportLiquidacion } from './handlers/exportLiquidacion';
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
  const handlePrintLiquidationCashier = () => exportLiquidacion(queryClient, date, setPrinting);
  const handlePrintDiaryLiquidation = () => exportDiario(queryClient, date, setPrinting);

  if (role === USER_TYPE.CASHIER) return <CurrentAcoountByUserTable />;
  return (
    <PageWrapper>
      <HeaderSection title={'Cuenta Corriente'}>
        <IsRoleCashier role={role}>
          <Box className={'flex flex-col gap-2'}>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              <Button onClick={handlePrintDiaryLiquidation} disabled={printing} className="gap-2">
                <FileText className="h-4 w-4" /> Exportar Diario
              </Button>
              <Button variant="outline" onClick={handlePrintLiquidationCashier} disabled={printing} className="gap-2">
                <FileDown className="h-4 w-4" /> Exportar Liquidación
              </Button>
              <Button variant={'outline'} onClick={() => { setPrintTotalsKey((k) => k + 1); setOpenPrintTotals(true); }} disabled={printing} className="gap-2">
                <CreditCard className="h-4 w-4" /> Exportar Cobros y Pagos
              </Button>
              <Button variant={'outline'} onClick={() => { setDailySummaryKey((k) => k + 1); setOpenDailySummary(true); }} disabled={printing} className="gap-2">
                <BarChart2 className="h-4 w-4" /> Resumen Cuenta Corriente
              </Button>
              <Button variant={'outline'} onClick={() => { setSubtotalsKey((k) => k + 1); setOpenSubtotals(true); }} disabled={printing} className="gap-2">
                <List className="h-4 w-4" /> Exportar Subtotales
              </Button>
              {role !== USER_TYPE.ADMIN && (
                <Button variant={'outline'} onClick={handleGenerateLiquidation} className="gap-2">
                  <Wallet className="h-4 w-4" /> Generar Liquidación
                </Button>
              )}
            </div>
            <Button variant={'outline'} onClick={handleUpdateCurrentAccount} className="gap-2 w-full">
              <RefreshCw className="h-4 w-4" /> Actualizar
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
