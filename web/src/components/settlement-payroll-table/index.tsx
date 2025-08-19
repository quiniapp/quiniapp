import { useState } from 'react';
import Box from '@/components/box';
import FilterSection from '@/components/filter-section';
import CurrentAccountTable from '@/features/agent-commission/current-account-table';
import { useGetCurrentAccount } from '@/hooks/fetchs/current-account/useGetCurrentAccount';
import { useSearchParams } from 'react-router-dom';
import dayjs from 'dayjs';

const SettlementPayrollTable = () => {
  const [group, setGroup] = useState<string>('Todos');
  const [employeeNumber, setEmployeeNumber] = useState<string>('');
  const [searchParams] = useSearchParams()
  const { data,  isLoading, isPending } = useGetCurrentAccount(searchParams.get('date'))

  return (
    <Box className="overflow-auto bg-[var(--primary-bg-content)] py-[24px] text-white">
      
      <FilterSection
        group={group}
        onGroupChange={setGroup}
        employeeNumber={employeeNumber}
        onEmployeeNumberChange={setEmployeeNumber}
      />
      <>Fecha de la Liquidación : {data?.[0]?.date && dayjs(data?.[0]?.date ).format('DD/MM/YYYY')}</>
      <CurrentAccountTable
        data={data ?? []}
        // totals={}
        isLoading={isLoading}
        isPending={isPending}
      />
    </Box>
  );
};

export default SettlementPayrollTable;
