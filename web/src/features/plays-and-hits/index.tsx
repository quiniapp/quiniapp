import { Search } from 'lucide-react';

import Box from '@/components/box';
import { Flex, FlexCol } from '@/components/flex';
import { Button } from '@/components/ui/button.tsx';
import HeaderPlayAndHits from '@/features/plays-and-hits/header-play-and-hits.tsx';
import PlayAndHitsBox from '@/features/plays-and-hits/play-and-hits-box.tsx';
import PlaysAndHitsTable from '@/features/plays-and-hits/plays-and-hits-table.tsx';
import TotalAmountPlayAndHits from '@/features/plays-and-hits/total-amount-play-and-hits.tsx';

const PlaysAndHitsContent = () => {
  return (
    <Box className={'grid grid-rows-[auto_1fr_auto] h-full  '}>
      <HeaderPlayAndHits />
      <Flex className={'flex-col 1440:py-[36px] py-[16px] space-y-8'}>
        <FlexCol className={'space-y-8 '}>
          <PlayAndHitsBox />
          <Box className={'w-[200px]'}>
            <Button className={'w-full'}>
              <Search /> Buscar
            </Button>
          </Box>
        </FlexCol>
        <PlaysAndHitsTable />
      </Flex>
      <TotalAmountPlayAndHits />
    </Box>
  );
};

export default PlaysAndHitsContent;
