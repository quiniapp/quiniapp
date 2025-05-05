import Box from '@/components/box';
import FilterSection from '@/components/filter-section';
import CurrentAccountTable from '@/features/agent-commission/current-account-table';

const SettlementPayrollTable = () => {
  return (
    <Box className="overflow-auto  bg-[var(--primary-bg-content)] py-[24px] text-white">
      <FilterSection />
      <CurrentAccountTable />
    </Box>
  );
};

export default SettlementPayrollTable;
