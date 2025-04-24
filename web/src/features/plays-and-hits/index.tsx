import { Button } from '@/components/ui/button.tsx';
import Box from '@/components/box';
import { Flex, FlexCol } from '@/components/flex';
import HeaderSection from '@/components/header-section';

import { SelectDayToSearch } from '@/features/plays-and-hits/select-day-to-search.tsx';
import PlaysAndHitsTable from '@/features/plays-and-hits/plays-and-hits-table.tsx';

import { XIcon, Search } from 'lucide-react';
import PlayAndHitsBox from '@/features/plays-and-hits/play-and-hits-box.tsx';

const PlaysAndHitsContent = () => {
  return (
    <Box className={'grid grid-rows-[auto_1fr_auto] h-full  '}>
      <HeaderSection title={'Juagadas'} className={'w-full'}>
        <Flex className={'justify-end  w-full items-center space-x-[24px] '}>
          <span className={'text-sm text-muted-foreground'}> Selecinar fecha</span>
          <SelectDayToSearch />
        </Flex>
      </HeaderSection>
      <Flex className={'flex-col space-y-8'}>
        <FlexCol className={'space-y-8 py-[24px]'}>
          <PlayAndHitsBox />
          <Box className={'w-[200px]'}>
            <Button className={'w-full'}>
              <Search /> Buscar
            </Button>
          </Box>
        </FlexCol>
        <PlaysAndHitsTable />
      </Flex>
      <Flex className={'items-center justify-between py-[16px]'}>
        <FlexCol>
          <p>Total Monto de juagada: </p>
          <p>Total Monto de ciertos: </p>
        </FlexCol>
        <Button className={'w-[130px] bg-white text-neutral-700 font-bold'}>
          Cerrar <XIcon />
        </Button>
      </Flex>
    </Box>
  );
};

export default PlaysAndHitsContent;
