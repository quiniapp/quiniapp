// Librerías de terceros
import { Search } from 'lucide-react'

// Componentes internos
import Box from '@/components/box'
import { Flex, FlexCol } from '@/components/flex'
import { Button } from '@/components/ui/button'
import PlayAndHitsBox from '@/features/plays-and-hits/play-and-hits-box'
import PlaysAndHitsTable from '@/features/plays-and-hits/plays-and-hits-table'

const SelectAndSearchBox = () => {
  return (
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
  );
};

export default SelectAndSearchBox;
