import FilterSection from '@/components/filter-section';
import Layout from '@/components/layout';
import SettlementPayrollTable from '@/components/settlement-payroll-table';

const Home = () => {
  return (
    <Layout classname="flex  ">
      <div className="flex flex-col md:flex-col   overflow-hidden">
        <FilterSection />
        <SettlementPayrollTable />
      </div>
    </Layout>
  );
};

export default Home;
