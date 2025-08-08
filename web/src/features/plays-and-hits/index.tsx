import { Search } from 'lucide-react';

import Box from '@/components/box';
import {  FlexCol } from '@/components/flex';
import { Button } from '@/components/ui/button.tsx';
import HeaderPlayAndHits from '@/features/plays-and-hits/header-play-and-hits.tsx';
import PlayAndHitsBox from '@/features/plays-and-hits/play-and-hits-box.tsx';
import PlaysAndHitsTable from '@/features/plays-and-hits/plays-and-hits-table.tsx';
import TotalAmountPlayAndHits from '@/features/plays-and-hits/total-amount-play-and-hits.tsx';
import { useBets } from '@/hooks/fetchs/plays/useBets';
import { useSearchParams } from 'react-router-dom';
import { useMemo } from 'react';

const PlaysAndHitsContent = () => {
  const [setSearchParams] = useSearchParams();
  const schedule_id = setSearchParams.get('schedule_id');

  const date = setSearchParams.get('date');
  const lottery_id = setSearchParams.get('lottery_id');
  const cashier_id = setSearchParams.get('cashier_id');
  const grouped = setSearchParams.get('grouped');
  const winners = setSearchParams.get('winners');
  const { data } = useBets({
    schedule_id: schedule_id,
    date: date,
    cashier_id: cashier_id,
    lottery_id: lottery_id,
    winners: winners,
    grouped:grouped
  });

  const { totalPlaysAmount, totalHitsAmount } = useMemo(() => {
    const totalPlaysAmount = data?.reduce((acc: number, bet) => {
      return acc + bet.amount;
    }, 0);
    const totalHitsAmount = data?.reduce((acc: number, bet) => {
      return acc + bet.prize;
    }, 0);
    return { totalPlaysAmount, totalHitsAmount };
  }, [data,schedule_id,lottery_id, date, grouped, winners]);

  

  return (
    <FlexCol
      className={'h-full sm:w-[1000px] 1440:w-full overflow-y-auto sm:overflow-hidden gap-1'}
    >
      <HeaderPlayAndHits />
      <FlexCol className={'p-1 sm:p-2 gap-2 '}>
        <PlayAndHitsBox />
        <Box className={'w-[200px]'}>
          <Button className={'w-full'}>
            <Search /> Buscar
          </Button>
        </Box>
      </FlexCol>
      <PlaysAndHitsTable bets={data} />
      <TotalAmountPlayAndHits
        totalPlaysAmount={totalPlaysAmount}
        totalHitsAmount={totalHitsAmount}
      />
    </FlexCol>
  );
};

export default PlaysAndHitsContent;
