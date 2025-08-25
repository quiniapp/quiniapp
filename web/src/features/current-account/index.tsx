import Box from '@/components/box';
import { Button } from '@/components/ui/button';
import HeaderSection from '@/components/header-section';
import SettlementPayrollTable from '@/components/settlement-payroll-table';

import { useSessionStore } from '@/stores/sessionStore';

import IsRoleCashier from '@/components/is-role-cashier';
import { useUpdateCurrentAcoount } from '@/hooks/mutations/current-account/useUpdateCurrentAccoutn';
import { useSearchParams } from 'react-router-dom';

import toast from 'react-hot-toast';
import { USER_TYPE } from '../../../../helper/types/user.type';
import CurrentAcoountByUserTable from './CurrentAcoountByUserTable';
import React, { Suspense, useState } from 'react';

const CurrentAccountContent = () => {
  const [open, setOpen] = useState<boolean>(false)
  const { role } = useSessionStore();
  const [searchParams] = useSearchParams();
  const { mutate } = useUpdateCurrentAcoount();
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

  const handleGenerateLiquidation = ()=>{

    setOpen(true)
  }


  if (role === USER_TYPE.CASHIER) return <CurrentAcoountByUserTable/>;
  return (
    <Box className={'grid grid-rows-[auto_1fr_auto] h-full  '}>
      <HeaderSection title={'Cuenta Corriente'}>
        <IsRoleCashier role={role}>
          <Box className={'grid grid-cols-2 gap-4'}>
            <Button> Exportar Diario</Button>
            <Button variant={'outline'}> Exportar Liquidación </Button>
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
        <GenerateLiquitationModal isOpen={open} onClose={()=>setOpen(false)}/>

      </Suspense>
    </Box>
  );
};

export default CurrentAccountContent;

const GenerateLiquitationModal = React.lazy(()=>import('../../components/modals/GenerateLiquitationModal'))
