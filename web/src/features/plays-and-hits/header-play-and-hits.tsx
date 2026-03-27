import HeaderSection from '@/components/header-section';
import { SelectDayToSearch } from '@/components/button/SelectDayToSearch';
import dayjs from 'dayjs';
import { useLayoutEffect } from 'react';
import { useSearchParams } from 'react-router-dom';

const HeaderPlayAndHits = () => {
  const today = dayjs();
  const [searchParams, setSearchParams] = useSearchParams();

  // Inicializar fecha solo si no está ya en la URL — evita render extra con useEffect
  useLayoutEffect(() => {
    if (!searchParams.get('date')) {
      setSearchParams({ date: today.format('YYYY-MM-DD') }, { replace: true });
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleDayChange = (date?: string) => {
    setSearchParams({ date: date ?? today.format('YYYY-MM-DD') });
  };

  return (
    <HeaderSection title={'Jugadas'}>
      <SelectDayToSearch onDayChange={handleDayChange} toDate={today.toDate()} />
    </HeaderSection>
  );
};

export default HeaderPlayAndHits;
