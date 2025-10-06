import { Flex, FlexCol } from '@/components/flex';
import HeaderPlayAndHits from '@/features/plays-and-hits/header-play-and-hits.tsx';
import PlaysAndHitsTable from '@/features/plays-and-hits/plays-and-hits-table.tsx';
import TotalAmountPlayAndHits from '@/features/plays-and-hits/total-amount-play-and-hits.tsx';
import { useBets } from '@/hooks/fetchs/plays/useBets';
import { useSearchParams } from 'react-router-dom';
import SelectBetType from './select-bet-type';
import PlayAndHitsToggleSelect from './play-and-hits-toggle-select';
import PlayAndHitsSelect from './play-and-hits-select';
import { useTotalAmount, useTotalPrize } from '@/hooks/fetchs/plays/useTotals';

const PlaysAndHitsContent = () => {

  const [setSearchParams] = useSearchParams();
  const schedule_id = setSearchParams.get('schedule_id');

  const date = setSearchParams.get('date');
  const lottery_id = setSearchParams.get('lottery_id');
  const cashier_id = setSearchParams.get('cashier_id');
  const grouped = setSearchParams.get('grouped');
  const winners = setSearchParams.get('winners');
  const quatern = setSearchParams.get('quatern');
  const tern = setSearchParams.get('tern');

  const { data } = useBets({
    schedule_id: schedule_id,
    date: date,
    cashier_id: cashier_id,
    lottery_id: lottery_id,
    grouped: grouped,
    quatern: quatern,
    tern: tern,
    winners: winners,
  });

  const { data: totalPlaysAmount } = useTotalAmount({
    schedule_id: schedule_id,
    date: date,
    cashier_id: cashier_id,
    lottery_id: lottery_id,
  });

  const { data: totalHitsAmount } = useTotalPrize({
    schedule_id: schedule_id,
    date: date,
    cashier_id: cashier_id,
    lottery_id: lottery_id,
  });


  return (
    <FlexCol
      className={'h-full sm:w-[1000px] 1440:w-full overflow-y-auto sm:overflow-hidden gap-1'}
    >
      <HeaderPlayAndHits />
      <FlexCol className={'p-1 sm:p-2 gap-2 '}>
        <PlayAndHitsToggleSelect />
        <Flex className="w-full">
          <SelectBetType />
          <PlayAndHitsSelect />
        </Flex>
      </FlexCol>
      <PlaysAndHitsTable bets={data ?? []} />
      <TotalAmountPlayAndHits
        totalPlaysAmount={totalPlaysAmount}
        totalHitsAmount={totalHitsAmount}
      />
    </FlexCol>
  );
};

export default PlaysAndHitsContent;
