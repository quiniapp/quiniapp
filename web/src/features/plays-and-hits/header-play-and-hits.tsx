import HeaderSection from '@/components/header-section';
import { SelectDayToSearch } from '@/components/button/SelectDayToSearch';
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
        <SelectDayToSearch onDayChange={handleDayChange} toDate={today.toDate()} />
    </HeaderSection>
  );
};

export default HeaderPlayAndHits;
