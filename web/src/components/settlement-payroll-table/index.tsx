import { useState } from 'react';
import Box from '@/components/box';
import FilterSection from '@/components/filter-section';
import CurrentAccountTable from '@/features/agent-commission/current-account-table';
import { useCurrentAccountTableLogic } from '@/features/current-account/hooks/use-current-account-table-logic';

const SettlementPayrollTable = () => {
  const [date, setDate] = useState<string | undefined>(undefined);
  const [group, setGroup] = useState<string>('Todos');
  const [employeeNumber, setEmployeeNumber] = useState<string>('');

  const { DATA, totals, isLoading, isPending } = useCurrentAccountTableLogic({
    date,
    group,
    employeeNumber,
  });

  return (
    <Box className="overflow-auto bg-[var(--primary-bg-content)] py-[24px] text-white">
      <FilterSection
        date={date}
        onDateChange={setDate}
        group={group}
        onGroupChange={setGroup}
        employeeNumber={employeeNumber}
        onEmployeeNumberChange={setEmployeeNumber}
      />
      <CurrentAccountTable
        data={DATA}
        totals={totals}
        isLoading={isLoading}
        isPending={isPending}
      />
    </Box>
  );
};

export default SettlementPayrollTable;
