import { Flex, FlexCol } from '@/components/flex';
import HeaderPlayAndHits from '@/features/plays-and-hits/header-play-and-hits.tsx';
import PlayAndHitsBox from '@/features/plays-and-hits/play-and-hits-box.tsx';
import PlaysAndHitsTable from '@/features/plays-and-hits/plays-and-hits-table.tsx';
import TotalAmountPlayAndHits from '@/features/plays-and-hits/total-amount-play-and-hits.tsx';
import { useBets } from '@/hooks/fetchs/plays/useBets';
import { useSearchParams } from 'react-router-dom';
import { useEffect, useMemo, useState } from 'react';
import SelectBetType from './select-bet-type';
import { BET_TYPE, IBetEntityFront } from '../../../../helper/types/bet.type';
import PlayAndHitsToggleSelect from './play-and-hits-toggle-select';
import PlayAndHitsSelect from './play-and-hits-select';

const PlaysAndHitsContent = () => {
  const [bets, setBets] = useState<IBetEntityFront[]>([]);

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
  });

  const totalHitsAmount = useMemo(() => {
    return data?.reduce((acc: number, bet) => {
      return acc + bet.prize;
    }, 0);
  }, [data, schedule_id, lottery_id, date]);

  const totalPlaysAmount = useMemo(() => {
    if (data)
      return data?.reduce((acc: number, bet) => {
        return acc + bet.amount;
      }, 0);
  }, [schedule_id, lottery_id, date, data]);

  useEffect(() => {
    if (data) {
      if (winners === 'true') {
        setBets(data.filter((bet: IBetEntityFront) => bet.winner));
      } else if (tern === 'true' && quatern === 'true') {
        setBets(
          data.filter(
            (bet: IBetEntityFront) =>
              bet.bet_type === BET_TYPE.QUATERN || bet.bet_type === BET_TYPE.TERN
          )
        );
      } else if (tern === 'true') {
        setBets(data.filter((bet: IBetEntityFront) => bet.bet_type === BET_TYPE.TERN));
      } else if (quatern === 'true') {
        setBets(data.filter((bet: IBetEntityFront) => bet.bet_type === BET_TYPE.QUATERN));
      } else {
        setBets(data);
      }
    }
  }, [data, grouped, winners, tern, quatern]);

  return (
    <FlexCol
      className={'h-full sm:w-[1000px] 1440:w-full overflow-y-auto sm:overflow-hidden gap-1'}
    >
      <HeaderPlayAndHits />
      <FlexCol className={'p-1 sm:p-2 gap-2 '}>
        <PlayAndHitsToggleSelect />
        <Flex className='w-full'>
          <SelectBetType />
          <PlayAndHitsSelect />
        </Flex>
      </FlexCol>
      <PlaysAndHitsTable bets={bets} />
      <TotalAmountPlayAndHits
        totalPlaysAmount={totalPlaysAmount}
        totalHitsAmount={totalHitsAmount}
      />
    </FlexCol>
  );
};

export default PlaysAndHitsContent;
