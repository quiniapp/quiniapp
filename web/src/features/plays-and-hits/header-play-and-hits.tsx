import { Flex } from '@/components/flex';
import HeaderSection from '@/components/header-section';
import { SelectDayToSearch } from '@/features/plays-and-hits/select-day-to-search.tsx';
import dayjs from 'dayjs';
import { useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';

const HeaderPlayAndHits = () => {
  const today = dayjs();

  const [_, setSearchParams] = useSearchParams();

  const handleDayChange = (date?: string) => {
    setSearchParams({ date: date ?? today.format('YYYY-MM-DD') });
  };

  useEffect(() => {
    handleDayChange();
  }, []);

  return (
    <HeaderSection title={'Jugadas'} >
      <Flex className={'justify-end  w-full items-center space-x-[24px] '}>
        <span className={'text-sm text-muted-foreground'}> Selecionar fecha</span>
        <SelectDayToSearch onDayChange={handleDayChange} toDate={today.toDate()} />
      </Flex>
    </HeaderSection>
  );
};

export default HeaderPlayAndHits;
