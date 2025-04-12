import FilterSection from '@/components/filter-section';

import SettlementPayrollTable from '@/components/settlement-payroll-table';

const Home = () => {
  return (
    <div className="flex flex-col md:flex-col   overflow-hidden">
      <FilterSection />
      <SettlementPayrollTable />
    </div>
  );
};

export default Home;
