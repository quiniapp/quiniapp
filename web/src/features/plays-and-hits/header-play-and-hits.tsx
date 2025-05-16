import { Flex } from '@/components/flex';
import HeaderSection from '@/components/header-section';
import { SelectDayToSearch } from '@/features/plays-and-hits/select-day-to-search.tsx';

const HeaderPlayAndHits = () => {
  return (
    <HeaderSection title={'Juagadas'} className={'w-full'}>
      <Flex className={'justify-end  w-full items-center space-x-[24px] '}>
        <span className={'text-sm text-muted-foreground'}> Selecinar fecha</span>
        <SelectDayToSearch />
      </Flex>
    </HeaderSection>
  );
};

export default HeaderPlayAndHits;
