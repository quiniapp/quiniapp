import Box from '@/components/box';
import { Button } from '@/components/ui/button';
import HeaderSection from '@/components/header-section';
import SettlementPayrollTable from '@/components/settlement-payroll-table';

import { useSessionStore } from '@/stores/sessionStore';

import IsRoleCashier from '@/components/is-role-cashier';

const CurrentAccountContent = () => {

  const { role } = useSessionStore()

  return (
    <Box className={'grid grid-rows-[auto_1fr_auto] h-full  '}>
      <HeaderSection title={'Cuenta Corriente'}>
        <IsRoleCashier role={role}>
          <Box className={'grid grid-cols-3 gap-4'}>
            <Button> Exportar Diario</Button>
            <Button variant={'outline'}> Exportar Liquidación </Button>
            <Button variant={'outline'}> Actualizar </Button>
          </Box>
        </IsRoleCashier>
      </HeaderSection>
      <SettlementPayrollTable />
    </Box>
  );
};

export default CurrentAccountContent;
