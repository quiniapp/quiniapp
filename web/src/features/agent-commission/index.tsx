import Box from '@/components/box';
import HeaderSection from '@/components/header-section';
import SettlementPayrollTable from '@/components/settlement-payroll-table';
import { Button } from '@/components/ui/button.tsx';

const CurrentAccountContent = () => {
  return (
    <Box className={'grid grid-rows-[auto_1fr_auto] h-full  '}>
      <HeaderSection title={'Cuenta Corriente'}>
        <Box className={'grid grid-cols-3 gap-4'}>
          <Button> Exportar Diario</Button>
          <Button variant={'outline'}> Exportar Liquidación </Button>
          <Button variant={'outline'}> Actualizar </Button>
        </Box>
      </HeaderSection>

      <SettlementPayrollTable />
    </Box>
  );
};

export default CurrentAccountContent;
