import FilterSection from '@/components/filter-section';

import SettlementPayrollTable from '@/components/settlement-payroll-table';
import { Flex, FlexCol } from '@/components/flex';

const Home = () => {
  return (
    <Flex>
      <FlexCol className=" md:flex-col   overflow-hidden">
      <FilterSection />
      <SettlementPayrollTable />
    </FlexCol>
    </Flex>
  );
};

export default Home;
