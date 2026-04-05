import { Flex, FlexCol } from '@/components/flex';
import HeaderPlayAndHits from '@/features/plays-and-hits/header-play-and-hits.tsx';
import PlaysAndHitsTable from '@/features/plays-and-hits/plays-and-hits-table.tsx';
import TotalAmountPlayAndHits from '@/features/plays-and-hits/total-amount-play-and-hits.tsx';
import SelectBetType from './select-bet-type';
import PlayAndHitsToggleSelect from './play-and-hits-toggle-select';
import PlayAndHitsSelect from './play-and-hits-select';
import PrintGroupedBetsButton from './print-grouped-bets-button';
import { PageWrapper } from '@/components/wrapper/PageWrapper';
import { useState, useCallback } from 'react';

const PlaysAndHitsContent = () => {
  const [totalPlaysAmount, setTotalPlaysAmount] = useState<number | undefined>();
  const [totalHitsAmount, setTotalHitsAmount] = useState<number | undefined>();

  const handleTotalsUpdate = useCallback((totalAmount?: number, totalPrize?: number) => {
    setTotalPlaysAmount(totalAmount);
    setTotalHitsAmount(totalPrize);
  }, []);

  return (
    <PageWrapper>
      <HeaderPlayAndHits />
      <FlexCol className={'p-1 sm:p-2 gap-2 '}>
        <Flex className="items-center gap-2">
          <PlayAndHitsToggleSelect />
          <PrintGroupedBetsButton />
        </Flex>
        <Flex className="flex-col sm:flex-row w-full">
          <SelectBetType />
          <PlayAndHitsSelect />
        </Flex>
      </FlexCol>
      <PlaysAndHitsTable onTotalsUpdate={handleTotalsUpdate} />
      <TotalAmountPlayAndHits
        totalPlaysAmount={totalPlaysAmount}
        totalHitsAmount={totalHitsAmount}
      />
    </PageWrapper>
  );
};

export default PlaysAndHitsContent;
