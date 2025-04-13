import Box from '@/components/box';
import HeaderSection from '@/components/header-section';
import { SelectDayToSearch } from '@/features/plays-and-hits/select-day-to-search.tsx';
import Flex from '@/components/flex';
import { Button } from '@/components/ui/button.tsx';
import PlaysAndHitsTable from '@/features/plays-and-hits/plays-and-hits-table.tsx';
import { XIcon } from 'lucide-react';

const PlaysAndHitsContent = () => {
  return (
    <Box className={'grid grid-rows-[auto_1fr_auto] h-full  '}>
      <HeaderSection title={'Juagadas'} className={'w-full'}>
        <SelectDayToSearch />
      </HeaderSection>
      <Flex className={'flex-col space-y-8'}>
        <Flex className={'flex-col'}>
          <p> Ver</p>
          <Flex className={'border flex-col '}>
            <p>checkboxes</p>
            <Button> Buscar </Button>
          </Flex>
        </Flex>
        <PlaysAndHitsTable />
      </Flex>
      <Flex className={'items-center justify-between py-[16px]'}>
        <p>Montos</p>
        <Button>
          Cerrar <XIcon />
        </Button>
      </Flex>
    </Box>
  );
};

export default PlaysAndHitsContent;
